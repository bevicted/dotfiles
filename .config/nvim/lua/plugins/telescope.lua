return {
    "telescope.nvim",
    dependencies = {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "make",
        config = function()
            require("telescope").load_extension("fzf")
        end,
    },
    opts = {
        defaults = {
            file_ignore_patterns = {
                ".git/",
            },
        },
        pickers = {
            find_files = {
                hidden = true,
            },
            live_grep = {
                additional_args = function(opts)
                    return { "--hidden" }
                end,
            },
        },
    },
}
