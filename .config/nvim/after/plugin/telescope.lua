local builtin = require('telescope.builtin')
vim.keymap.set('n', '<leader>ff', builtin.find_files, {})
vim.keymap.set('n', '<leader>fgf', builtin.git_files, {})
vim.keymap.set('n', '<leader>rg', builtin.live_grep, {})

require("telescope").setup {
    pickers = {
        find_files = {
            hidden = true,
        },
        live_grep = {
            additional_args = function(opts)
                return { "--hidden" }
            end
        },
    },
}
