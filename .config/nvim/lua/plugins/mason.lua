return {
    "williamboman/mason.nvim",
    opts = {
        ensure_installed = {
            "stylua",
            "shellcheck",
            "shfmt",
            "flake8",
            "gopls",
            "golangci-lint",
            "golangci-lint-langserver",
            "rust-analyzer",
            "rustfmt",
        },
    },
}
