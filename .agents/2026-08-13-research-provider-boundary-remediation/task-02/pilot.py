#!/usr/bin/env python3
"""Run Task 02's unscored deterministic and authenticated qualification.

All raw output stays below the ignored audit directory. Historical v3-v7 input
is never opened, modified, or retried.
"""
import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
MODEL = "openai-codex/gpt-5.6-sol:high"
MARKERS = ["TASK02_PRIVATE_A_9f44be6c", "TASK02_PRIVATE_B_9f44be6c", "TASK02_PRIVATE_C_9f44be6c"]
ALLOWED_CHILD_CUSTOM_TYPES = {
    "research-child", "research-context", "research-work-budget", "research-fetch-evidence",
}
AUDIT_ROOT = ROOT / ".agents/2026-08-13-research-provider-boundary-remediation/audit/task-02"
SOURCE_FILES = [
    ROOT / ".gitignore",
    *sorted(path for path in HERE.iterdir() if path.is_file()),
    *sorted((ROOT / ".pi/agent/extensions/subagent").glob("*.ts")),
    *sorted((ROOT / ".pi/agent/extensions/web-fetch").glob("*.ts")),
    *sorted((ROOT / ".pi/agent/extensions/web-search").glob("*.ts")),
    ROOT / ".pi/agent/models.json",
    Path.home() / ".pi/agent/models-store.json",
]


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def sha256(path):
    return sha256_bytes(path.read_bytes())


def jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def command_output(argv):
    completed = subprocess.run(argv, cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return completed.stdout


def source_name(path):
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)


def absent():
    return {"absent": True}


def git_blob(revision, relative):
    completed = subprocess.run(
        ["git", "rev-parse", "--verify", f"{revision}:{relative}"],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    return completed.stdout.decode().strip() if completed.returncode == 0 else None


def index_blob(relative):
    completed = subprocess.run(
        ["git", "ls-files", "--stage", "--", relative],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    )
    entries = completed.stdout.decode().splitlines()
    if not entries:
        return None
    mode, object_id, stage_and_path = entries[0].split(" ", 2)
    stage, _path = stage_and_path.split("\t", 1)
    if mode == "160000" or stage != "0":
        raise RuntimeError(f"unsupported index entry for {relative}")
    return object_id


def blob_manifest(object_id):
    if object_id is None:
        return absent()
    return {
        "objectId": object_id,
        "contentSha256": sha256_bytes(command_output(["git", "cat-file", "blob", object_id])),
    }


def source_manifest(path):
    relative = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else None
    return {
        # New AM paths have an absent HEAD blob and independently recorded index
        # and worktree content. Never infer one layer from another.
        "head": blob_manifest(git_blob("HEAD", relative)) if relative else absent(),
        "index": blob_manifest(index_blob(relative)) if relative else absent(),
        "worktree": {"sha256": sha256(path)} if path.is_file() else absent(),
    }


def repository_manifest():
    def digest(argv):
        return sha256_bytes(command_output(argv))
    return {
        "head": command_output(["git", "rev-parse", "HEAD"]).decode().strip(),
        "statusPorcelainV1": command_output(["git", "status", "--porcelain=v1", "--untracked-files=all"]).decode(),
        # Store only hashes, not diffs: worktree changes can contain credentials.
        "headToIndexDiffSha256": digest(["git", "diff", "--cached", "--binary"]),
        "indexToWorktreeDiffSha256": digest(["git", "diff", "--binary"]),
        "headToWorktreeDiffSha256": digest(["git", "diff", "HEAD", "--binary"]),
        "sources": {source_name(path): source_manifest(path) for path in SOURCE_FILES},
    }


def assert_repository_unchanged(expected):
    actual = repository_manifest()
    if actual != expected:
        raise RuntimeError("source, status, or aggregate diff changed during qualification")


def response_pairs(payload):
    items = payload.get("input", []) if isinstance(payload, dict) else []
    calls = [(item.get("call_id"), item.get("name")) for item in items if isinstance(item, dict) and item.get("type") == "function_call"]
    outputs = [(item.get("call_id"), item.get("output")) for item in items if isinstance(item, dict) and item.get("type") == "function_call_output"]
    return calls, outputs


def named_tool_schemas(payload):
    for tool in payload.get("tools", []) if isinstance(payload, dict) else []:
        if not isinstance(tool, dict) or tool.get("type") != "function":
            continue
        name = tool.get("name") or (tool.get("function") or {}).get("name")
        if not isinstance(name, str) or not name.strip():
            raise AssertionError(f"unnamed function tool schema: {tool}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", type=Path, required=True)
    args = parser.parse_args()
    audit = args.audit_dir.resolve()
    if not audit.is_relative_to(AUDIT_ROOT.resolve()):
        raise SystemExit(f"audit directory must be below ignored {AUDIT_ROOT}")
    if audit.exists():
        raise SystemExit(f"refusing to overwrite existing audit directory: {audit}")
    ignored = subprocess.run(["git", "check-ignore", "-q", str(audit.relative_to(ROOT))], cwd=ROOT)
    if ignored.returncode != 0:
        raise SystemExit(f"audit directory is not git-ignored: {audit}")
    audit.mkdir(parents=True)
    for directory in ("captures", "commands", "sessions", "fixture", "exports", "child-copies"):
        (audit / directory).mkdir()
    initial_repository = repository_manifest()
    dump(audit / "source-manifest.json", initial_repository)

    statuses = []
    def run(name, argv, env=None, timeout=600, check=True):
        assert_repository_unchanged(initial_repository)
        started = time.time()
        chosen_env = env if env is not None else os.environ
        selected = {key: bool(chosen_env.get(key)) for key in ("PI_SUBAGENT_DEPTH", "OPENAI_API_KEY")}
        stdout = ""
        stderr = ""
        exit_code = None
        timed_out = False
        failure = None
        signal_name = None
        try:
            completed = subprocess.run(argv, cwd=ROOT, env=env, text=True, capture_output=True, timeout=timeout)
            stdout, stderr, exit_code = completed.stdout, completed.stderr, completed.returncode
            if exit_code < 0:
                signal_name = signal.Signals(-exit_code).name
            if exit_code != 0:
                failure = f"exit code {exit_code}"
        except subprocess.TimeoutExpired as error:
            timed_out = True
            failure = f"timed out after {timeout} seconds"
            stdout = error.stdout.decode() if isinstance(error.stdout, bytes) else (error.stdout or "")
            stderr = error.stderr.decode() if isinstance(error.stderr, bytes) else (error.stderr or "")
        except BaseException as error:
            failure = f"{type(error).__name__}: {error}"
        finally:
            (audit / "commands" / f"{name}.stdout").write_text(stdout, encoding="utf-8")
            (audit / "commands" / f"{name}.stderr").write_text(stderr, encoding="utf-8")
            status = {
                "name": name, "argv": argv, "exitCode": exit_code, "timedOut": timed_out,
                "signal": signal_name, "failure": failure,
                "elapsedSeconds": round(time.time() - started, 3),
                "selectedEnvironmentPresent": selected,
            }
            dump(audit / "commands" / f"{name}.status.json", status)
            statuses.append(status)
        if check and failure:
            raise RuntimeError(f"{name} {failure}; inspect {audit / 'commands' / (name + '.stdout')} and .stderr")
        return status

    clean_env = os.environ.copy()
    clean_env.pop("PI_SUBAGENT_DEPTH", None)
    run("focused-research-subagent", ["node", "--test", ".pi/agent/extensions/subagent/subagent.test.ts", ".pi/agent/extensions/subagent/research.test.ts", ".pi/agent/extensions/subagent/research-context.test.ts", str(HERE / "capture-extension.test.ts")], clean_env, timeout=300)
    run("web-suites", ["node", "--test", ".pi/agent/extensions/web-fetch/fetch.test.ts", ".pi/agent/extensions/web-search/mcp.test.ts"], clean_env, timeout=300)
    run("offline-extension-load", ["pi", "--no-extensions", "--extension", ".pi/agent/extensions/subagent/index.ts", "--extension", ".pi/agent/extensions/web-fetch/index.ts", "--extension", ".pi/agent/extensions/web-search/index.ts", "--help"], {**clean_env, "PI_OFFLINE": "1"}, timeout=120)
    run("diff-check-index", ["git", "diff", "--cached", "--check"], clean_env, timeout=120)
    run("diff-check-worktree", ["git", "diff", "--check"], clean_env, timeout=120)
    run("history-integrity", ["git", "diff", "--exit-code", "HEAD", "--", ".agents/2026-08-13-research-context-isolation", ".agents/2026-08-13-research-provider-boundary-remediation/TASKS.md"], clean_env, timeout=120)
    run("deterministic-cancellation-restart", ["node", "--test", "--test-name-pattern", "normal Pi isolates child extensions|trusted Research sessions persist|registered Research rejects concurrent continuation", ".pi/agent/extensions/subagent/subagent.test.ts"], clean_env, timeout=180)

    server_env = {**clean_env, "TASK02_FIXTURE_OUTPUT": str(audit / "fixture")}
    assert_repository_unchanged(initial_repository)
    server = subprocess.Popen([sys.executable, str(HERE / "fixture_server.py")], cwd=ROOT, env=server_env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    ready = ""
    try:
        ready = server.stdout.readline().strip()
        if not ready:
            raise RuntimeError("fixture server did not emit readiness JSON")
        dump(audit / "fixture" / "server-ready.json", json.loads(ready))
        parent = audit / "sessions" / "parent.jsonl"
        capture = HERE / "capture-extension.ts"
        subagent = ROOT / ".pi/agent/extensions/subagent/index.ts"
        webfetch = ROOT / ".pi/agent/extensions/web-fetch/index.ts"
        websearch = ROOT / ".pi/agent/extensions/web-search/index.ts"
        # Capture intentionally precedes production subagent so terminal capture
        # is outside its provider guard and observes the transmitted payload.
        common = ["pi", "--mode", "json", "-p", "--no-context-files", "--no-skills", "--no-prompt-templates", "--model", MODEL, "--session", str(parent), "--no-builtin-tools", "--no-extensions", "--extension", str(capture), "--extension", str(subagent), "--extension", str(webfetch), "--extension", str(websearch)]
        fresh_prompt = """Use the Research tool exactly once. Delegate this exact task: fetch http://127.0.0.1:38462/a.txt and http://127.0.0.1:38462/b.txt with webfetch, determine whether capacity and rollback gates passed, and return the required bounded Research report with citations. Do not use web tools yourself. Raw fixture markers are private evidence and must not appear in the report. The first non-heading Answer line must cite both fixture URLs in Markdown."""
        fresh_env = {**clean_env, "TASK02_CAPTURE_FILE": str(audit / "captures" / "fresh.jsonl"), "TASK02_PHASE": "fresh"}
        run("authenticated-fresh", [*common, "--tools", "research,websearch,webfetch", fresh_prompt], fresh_env)
        parent_entries = jsonl(parent)
        first_result = [entry["message"] for entry in parent_entries if entry.get("type") == "message" and entry.get("message", {}).get("role") == "toolResult" and entry["message"].get("toolName") == "research"][-1]
        first_session = first_result["details"]["session"]
        research_id, child_id = first_session["researchId"], first_session["childSessionId"]
        dump(audit / "lineage.json", {"researchId": research_id, "childSessionId": child_id, "parentSession": str(parent)})

        downstream_env = {**clean_env, "TASK02_CAPTURE_FILE": str(audit / "captures" / "downstream.jsonl"), "TASK02_PHASE": "downstream"}
        downstream_prompt = "Based only on the bounded Research result already in this session, state whether both gates passed. Do not use tools."
        parent_base = common[:common.index("--no-extensions")]
        run("authenticated-downstream", [*parent_base, "--no-tools", "--no-extensions", "--extension", str(capture), "--extension", str(subagent), downstream_prompt], downstream_env)

        resume_env = {**clean_env, "TASK02_CAPTURE_FILE": str(audit / "captures" / "resume.jsonl"), "TASK02_PHASE": "resume"}
        resume_prompt = f"""Use the Research tool exactly once with researchId {research_id}. Delegate this exact continuation: retain the earlier A and B provenance, fetch http://127.0.0.1:38462/c.txt exactly once with webfetch, then return the required bounded Research report with citations for the capacity, rollback, and security gates. Do not use web tools yourself. Raw fixture markers are private evidence and must not appear in the report. The first non-heading Answer line must cite all three fixture URLs in Markdown."""
        run("authenticated-resume", [*common, "--tools", "research,websearch,webfetch", resume_prompt], resume_env)

        parent_entries = jsonl(parent)
        research_results = [entry["message"] for entry in parent_entries if entry.get("type") == "message" and entry.get("message", {}).get("role") == "toolResult" and entry["message"].get("toolName") == "research"]
        resumed_result = research_results[-1]
        resumed_session = resumed_result["details"]["session"]
        assert resumed_session["researchId"] == research_id and resumed_session["childSessionId"] == child_id and resumed_session["resumed"] is True
        child_candidates = [candidate for candidate in (audit / "sessions").glob("*.jsonl") if candidate != parent and jsonl(candidate)[0].get("id") == child_id]
        assert len(child_candidates) == 1, child_candidates
        child = child_candidates[0]
        child_copy = audit / "child-copies" / child.name
        shutil.copyfile(child, child_copy)
        dump(audit / "hashes.json", {"parentSha256": sha256(parent), "childSha256": sha256(child), "childCopySha256": sha256(child_copy)})
        run("child-export", ["pi", "--export", str(child), str(audit / "exports" / "child.html")], clean_env, timeout=120)

        interactive = f'''set timeout 30
log_user 1
spawn pi --session {{{parent}}} --no-extensions --extension {{{subagent}}}
expect -re {{Ctrl\\+O to expand}}
send "\\017"
expect -re {{--- Task ---}}
send "\\004"
expect eof
'''
        interactive_script = audit / "commands" / "interactive-rendering.expect"
        interactive_script.write_text(interactive, encoding="utf-8")
        run("interactive-rendering", ["expect", "-f", str(interactive_script)], clean_env, timeout=60)
        shutil.copyfile(audit / "commands" / "interactive-rendering.stdout", audit / "interactive-rendering.ansi")

        capture_records = {path.stem: jsonl(path) for path in (audit / "captures").glob("*.jsonl")}
        assert set(capture_records) == {"fresh", "downstream", "resume"}
        terminal_payloads = {}
        for phase, records in capture_records.items():
            assert records and any(record["kind"] == "pre_terminal_context" for record in records), f"missing pre-terminal context for {phase}"
            terminal = [record["value"]["payload"] for record in records if record["kind"] == "terminal_transport_payload"]
            assert terminal, f"missing terminal transport capture for {phase}"
            terminal_payloads[phase] = terminal
            # Pre-terminal context is intentionally retained as a separate raw
            # diagnostic. Only this provider capture is the transport boundary.
            for payload in terminal:
                serialized = json.dumps(payload, sort_keys=True)
                for marker in MARKERS:
                    assert marker not in serialized, f"{marker} leaked in terminal {phase} payload"
                named_tool_schemas(payload)
                assert payload.get("model") != "None"
                assert "Research isolation failure" not in json.dumps(payload, sort_keys=True)
        assert all(not payload.get("tools") for payload in terminal_payloads["downstream"]), "downstream advertised tools"
        for phase in ("fresh", "resume"):
            research_call_counts = []
            for payload in terminal_payloads[phase]:
                calls, outputs = response_pairs(payload)
                research_calls = [call_id for call_id, name in calls if name == "research"]
                for call_id in research_calls:
                    assert sum(1 for output_id, output in outputs if output_id == call_id and isinstance(output, str) and output) == 1
                research_call_counts.append(len(research_calls))
            assert max(research_call_counts, default=0) == (1 if phase == "fresh" else 2), f"invalid native Research pairs in terminal {phase} capture"
        for result in (first_result, resumed_result):
            content = result["content"]
            assert len(content) == 1 and content[0]["type"] == "text"
            assert len(content[0]["text"].encode()) <= 8 * 1024 and len(content[0]["text"].splitlines()) <= 400
            assert "Research ID:" in content[0]["text"]
        child_entries = jsonl(child)
        child_text = json.dumps(child_entries)
        assert fresh_prompt not in child_text and downstream_prompt not in child_text
        custom_types = {entry.get("customType") for entry in child_entries if entry.get("type") == "custom"}
        assert custom_types <= ALLOWED_CHILD_CUSTOM_TYPES, custom_types
        budgets = [entry["data"] for entry in child_entries if entry.get("type") == "custom" and entry.get("customType") == "research-work-budget" and "configured" in entry.get("data", {})]
        assert len({budget["invocationId"] for budget in budgets}) >= 2
        access = jsonl(audit / "fixture" / "fixture-access.jsonl")
        counts = Counter(item["path"] for item in access)
        assert counts == Counter({"/a.txt": 1, "/b.txt": 1, "/c.txt": 1}), counts
        usage = [entry["message"].get("usage") for entry in parent_entries + child_entries if entry.get("type") == "message" and entry.get("message", {}).get("role") == "assistant"]
        dump(audit / "usage.json", {"assistantUsage": usage, "workBudgetConfigurations": budgets, "fixtureAccessCounts": counts})
        child.unlink()
        dump(audit / "deletion.json", {"exportExists": (audit / "exports" / "child.html").is_file(), "liveChildDeleted": not child.exists(), "copiedChildSha256": sha256(child_copy)})
    finally:
        if server.poll() is None:
            server.send_signal(signal.SIGTERM)
        try:
            stdout, stderr = server.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            stdout, stderr = server.communicate()
        (audit / "fixture" / "server.stdout").write_text(ready + "\n" + stdout, encoding="utf-8")
        (audit / "fixture" / "server.stderr").write_text(stderr, encoding="utf-8")
        final_repository = repository_manifest()
        matches_initial = final_repository == initial_repository
        dump(audit / "final-repository.json", final_repository)
        dump(audit / "source-manifest-verification.json", {"matchesInitial": matches_initial})
        if not matches_initial and sys.exc_info()[0] is None:
            raise RuntimeError("source manifest verification failed: sources, status, or aggregate diffs changed during qualification")
    dump(audit / "summary.json", {
        "unscored": True,
        "model": MODEL,
        "researchId": research_id,
        "childSessionId": child_id,
        "statuses": statuses,
        "sourceManifestVerified": True,
        "checks": "passed",
    })
    print(audit / "summary.json")


if __name__ == "__main__":
    main()
