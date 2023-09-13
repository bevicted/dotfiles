-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- move and indent v selected lines
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv", { noremap = true, silent = true })
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv", { noremap = true, silent = true })

-- modify J to not move cursor
vim.keymap.set("n", "J", "mzJ`z", { noremap = true, silent = true })

-- modify half page jumping to keep cursor in the middle
vim.keymap.set("n", "<C-d>", "<C-d>zz", { noremap = true, silent = true })
vim.keymap.set("n", "<C-u>", "<C-u>zz", { noremap = true, silent = true })

-- modify search result jumping to keep cursor in the middle
vim.keymap.set("n", "n", "nzzzv", { noremap = true, silent = true })
vim.keymap.set("n", "N", "Nzzzv", { noremap = true, silent = true })

-- paste w/o copying what is being pasted over
vim.keymap.set("x", "<leader>p", '"_dP', { noremap = true, silent = true, desc = "Paste & don't copy" })

-- sys clipboard yank
vim.keymap.set("n", "<leader>y", '"+y', { noremap = true, silent = true, desc = "Yank to clipboard" })
vim.keymap.set("v", "<leader>y", '"+y', { noremap = true, silent = true, desc = "Yank to clipboard" })
vim.keymap.set("n", "<leader>Y", '"+Y', { noremap = true, silent = true, desc = "Yank to clipboard" })

-- delete without copy
vim.keymap.set("n", "<leader>d", '"_d', { noremap = true, silent = true })
vim.keymap.set("v", "<leader>d", '"_d', { noremap = true, silent = true })

-- intelliJ compatiblity remap for ctrl+c
vim.keymap.set("i", "<C-c>", "<Esc>", { noremap = true, silent = true })

-- just dont
vim.keymap.set("n", "Q", "<nop>", { noremap = true, silent = true })

-- new tmux session
vim.keymap.set("n", "<C-f>", "<cmd>silent !tmux neww tmux-sessionizer<CR>", { noremap = true, silent = true })

-- format code
vim.keymap.set(
    "n",
    "<leader>f",
    "<cmd>lua vim.lsp.buf.format({async = true})<cr>",
    { noremap = true, silent = true, buffer = true }
)

-- quickfix list
vim.keymap.set("n", "<C-k>", "<cmd>cnext<CR>zz", { noremap = true, silent = true })
vim.keymap.set("n", "<C-j>", "<cmd>cprev<CR>zz", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>k", "<cmd>lnext<CR>zz", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>j", "<cmd>lprev<CR>zz", { noremap = true, silent = true })

-- make file executable
vim.keymap.set("n", "<leader>chm", "<cmd>!chmod +x %<CR><CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>ex", "<cmd>:!%:p<CR>", { noremap = true, silent = true })

-- custom
vim.keymap.set(
    "n",
    "<leader>i",
    "<cmd>lua vim.lsp.buf.hover()<CR>",
    { noremap = true, silent = true, desc = "Inspect" }
)
