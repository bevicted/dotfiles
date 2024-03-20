-- [[ Basic Keymaps ]]
--  See `:help vim.keymap.set()`

-- [ esc ]

vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')
-- intelliJ compatiblity remap for ctrl+c
vim.keymap.set('i', '<C-c>', '<Esc>', { noremap = true, silent = true })
-- disable Q (Ex mode)
vim.keymap.set('n', 'Q', '<nop>', { noremap = true, silent = true })

-- [ diagnostics ]

vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous [D]iagnostic message' })
vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next [D]iagnostic message' })
vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Show diagnostic [E]rror messages' })
vim.keymap.set('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostic [Q]uickfix list' })

-- [ terminal ]

-- Exit terminal mode in the builtin terminal with a shortcut that is a bit easier
-- for people to discover. Otherwise, you normally need to press <C-\><C-n>, which
-- is not what someone will guess without a bit more experience.
--
-- NOTE: This won't work in all terminal emulators/tmux/etc. Try your own mapping
-- or just use <C-\><C-n> to exit terminal mode
vim.keymap.set('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

-- [ training ]

-- Disable arrow keys in normal mode
vim.keymap.set('n', '<left>', '<cmd>echo "Use h to move!!"<CR>')
vim.keymap.set('n', '<right>', '<cmd>echo "Use l to move!!"<CR>')
vim.keymap.set('n', '<up>', '<cmd>echo "Use k to move!!"<CR>')
vim.keymap.set('n', '<down>', '<cmd>echo "Use j to move!!"<CR>')

-- [ splits ]

-- Keybinds to make split navigation easier.
--  Use CTRL+<hjkl> to switch between windows
--
--  See `:help wincmd` for a list of all window commands
vim.keymap.set('n', '<C-h>', '<C-w><C-h>', { desc = 'Move focus to the left window' })
vim.keymap.set('n', '<C-l>', '<C-w><C-l>', { desc = 'Move focus to the right window' })
vim.keymap.set('n', '<C-j>', '<C-w><C-j>', { desc = 'Move focus to the lower window' })
vim.keymap.set('n', '<C-k>', '<C-w><C-k>', { desc = 'Move focus to the upper window' })

-- [ copy ]

-- paste w/o copying what is being pasted over
vim.keymap.set('x', '<leader>p', '"_dP', { noremap = true, silent = true, desc = "Paste & don't copy" })

-- sys clipboard yank
vim.keymap.set('n', '<leader>y', '"+y', { noremap = true, silent = true, desc = 'Yank to clipboard' })
vim.keymap.set('v', '<leader>y', '"+y', { noremap = true, silent = true, desc = 'Yank to clipboard' })
vim.keymap.set('n', '<leader>Y', '"+Y', { noremap = true, silent = true, desc = 'Yank to clipboard' })

-- delete without copy
vim.keymap.set('n', '<leader>d', '"_d', { noremap = true, silent = true, desc = "Delete & don't copy" })
vim.keymap.set('v', '<leader>d', '"_d', { noremap = true, silent = true, desc = "Delete & don't copy" })

-- [ jumping ]

-- modify half page jumping to keep cursor in the middle
vim.keymap.set('n', '<C-d>', '<C-d>zz', { noremap = true, silent = true })
vim.keymap.set('n', '<C-u>', '<C-u>zz', { noremap = true, silent = true })

-- modify search result jumping to keep cursor in the middle
vim.keymap.set('n', 'n', 'nzzzv', { noremap = true, silent = true })
vim.keymap.set('n', 'N', 'Nzzzv', { noremap = true, silent = true })

-- [ other ]

-- move and indent v selected lines
vim.keymap.set('v', 'J', ":m '>+1<CR>gv=gv", { noremap = true, silent = true })
vim.keymap.set('v', 'K', ":m '<-2<CR>gv=gv", { noremap = true, silent = true })

-- modify J to not move cursor
vim.keymap.set('n', 'J', 'mzJ`z', { noremap = true, silent = true })

-- new tmux session
vim.keymap.set('n', '<C-f>', '<cmd>silent !tmux neww tmux-sessionizer<CR>', { noremap = true, silent = true })

-- quickfix list
-- vim.keymap.set("n", "<C-k>", "<cmd>cnext<CR>zz", { noremap = true, silent = true })
-- vim.keymap.set("n", "<C-j>", "<cmd>cprev<CR>zz", { noremap = true, silent = true })
-- vim.keymap.set("n", "<leader>k", "<cmd>lnext<CR>zz", { noremap = true, silent = true })
-- vim.keymap.set("n", "<leader>j", "<cmd>lprev<CR>zz", { noremap = true, silent = true })

-- vim: ts=2 sts=2 sw=2 et
