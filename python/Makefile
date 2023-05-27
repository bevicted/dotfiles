.PHONY: user-setup
user-setup:
	# create venv, install requirements
	python3.10 -m venv ${CURDIR}/.venv && \
		source ${CURDIR}/.venv/bin/activate && \
		python3.10 -m pip install -r requirements.txt && \
		python3.10 -m pip install -e "${CURDIR}" && \
		deactivate
	########
	# DONE #
	########
	# don't forget to source the venv in the shell you'll run tests in, via:
	#	source .venv/bin/activate
	# with the venv sourced, run tests via:
	#	robot -d reports tests/<FILE>.robot

.PHONY: dev-setup
dev-setup:
	# create venv, install pip-tools, sync env
	python3.10 -m venv ${CURDIR}/.venv && \
		source "${CURDIR}/.venv/bin/activate" && \
		python3.10 -m pip install pip-tools && \
		pip-sync requirements.txt dev-requirements.txt && \
		python3.10 -m pip install -e "${CURDIR}" && \
		deactivate

.PHONY: install-remote
install-remote:
		python3 -m pip install git+https:url

.PHONY: install-editable
install-editable:
		python3.10 -m pip install -e "${CURDIR}"

.PHONY: compile-deps
compile-deps:
	# compile deps into [dev-]requirements.txt
	rm -f requirements.txt dev-requirements.txt
	pip-compile pyproject.toml -o requirements.txt --resolver backtracking
	pip-compile pyproject.toml -o dev-requirements.txt --resolver backtracking --extra dev

.PHONY: sync-env
sync-env:
	# sync env with [dev-]requirements.txt
	pip-sync requirements.txt dev-requirements.txt

.PHONY: lint
lint:
	mypy "${CURDIR}"
	bandit -rq -c "${CURDIR}/pyproject.toml" "${CURDIR}"
	black --check --diff "${CURDIR}"
	ruff check .

