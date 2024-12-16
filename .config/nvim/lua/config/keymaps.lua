-- [[ Basic Keymaps ]]
--  See `:help vim.keymap.set()`

local set = vim.keymap.set

-- [ esc ]

set('n', '<Esc>', '<cmd>nohlsearch<CR>')
-- intelliJ compatiblity remap for ctrl+c
set('i', '<C-c>', '<Esc>', { noremap = true, silent = true })
-- disable Q (Ex mode)
set('n', 'Q', '<nop>', { noremap = true, silent = true })

-- [ diagnostics ]

set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous [D]iagnostic message' })
set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next [D]iagnostic message' })
set('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Show diagnostic [E]rror messages' })
set('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostic [Q]uickfix list' })

-- [ exec ]

set('n', '<space><space>x', '<cmd>source %<CR>')
set('n', '<space>x', ':.lua<CR>')
set('v', '<space>x', ':lua<CR>')

-- [ terminal ]

-- NOTE: This won't work in all terminal emulators/tmux/etc. Try your own mapping
-- or just use <C-\><C-n> to exit terminal mode
set('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

-- [ training ]

-- Disable arrow keys in normal mode
set('n', '<left>', '<cmd>echo "Use h"<CR>')
set('n', '<right>', '<cmd>echo "Use l"<CR>')
set('n', '<up>', '<cmd>echo "Use k"<CR>')
set('n', '<down>', '<cmd>echo "Use j"<CR>')

-- [ splits ]

-- Keybinds to make split navigation easier.
--  Use CTRL+<hjkl> to switch between windows
--
--  See `:help wincmd` for a list of all window commands
set('n', '<C-h>', '<C-w><C-h>', { desc = 'Move focus to the left window' })
set('n', '<C-l>', '<C-w><C-l>', { desc = 'Move focus to the right window' })
set('n', '<C-j>', '<C-w><C-j>', { desc = 'Move focus to the lower window' })
set('n', '<C-k>', '<C-w><C-k>', { desc = 'Move focus to the upper window' })

-- [ copy ]

-- paste w/o copying what is being pasted over
set('x', '<leader>p', '"_dP', { noremap = true, silent = true, desc = "Paste & don't copy" })

-- sys clipboard yank
set('n', '<leader>y', '"+y', { noremap = true, silent = true, desc = 'Yank to clipboard' })
set('v', '<leader>y', '"+y', { noremap = true, silent = true, desc = 'Yank to clipboard' })
set('n', '<leader>Y', '"+Y', { noremap = true, silent = true, desc = 'Yank to clipboard' })

-- delete without copy
set('n', '<leader>d', '"_d', { noremap = true, silent = true, desc = "Delete & don't copy" })
set('v', '<leader>d', '"_d', { noremap = true, silent = true, desc = "Delete & don't copy" })

-- [ jumping ]

-- modify half page jumping to keep cursor in the middle
set('n', '<C-d>', '<C-d>zz', { noremap = true, silent = true })
set('n', '<C-u>', '<C-u>zz', { noremap = true, silent = true })

-- modify search result jumping to keep cursor in the middle
set('n', 'n', 'nzzzv', { noremap = true, silent = true })
set('n', 'N', 'Nzzzv', { noremap = true, silent = true })

-- [ other ]

-- move and indent v selected lines
set('v', 'J', ":m '>+1<CR>gv=gv", { noremap = true, silent = true })
set('v', 'K', ":m '<-2<CR>gv=gv", { noremap = true, silent = true })

-- modify J to not move cursor
set('n', 'J', 'mzJ`z', { noremap = true, silent = true })

-- new tmux session
set('n', '<C-f>', '<cmd>silent !tmux neww tmux-sessionizer<CR>', { noremap = true, silent = true })

-- quickfix list
-- set("n", "<C-k>", "<cmd>cnext<CR>zz", { noremap = true, silent = true })
-- set("n", "<C-j>", "<cmd>cprev<CR>zz", { noremap = true, silent = true })
-- set("n", "<leader>k", "<cmd>lnext<CR>zz", { noremap = true, silent = true })
-- set("n", "<leader>j", "<cmd>lprev<CR>zz", { noremap = true, silent = true })

-- vim: ts=2 sts=2 sw=2 et
