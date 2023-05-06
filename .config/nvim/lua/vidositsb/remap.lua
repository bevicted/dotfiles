-- use space as <leader>
vim.g.mapleader = " "
-- file explore
vim.keymap.set("n", "<leader>ex", vim.cmd.Ex)

-- move and indent v selected lines
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- modify J to not move cursor
vim.keymap.set("n", "J", "mzJ`z")
-- modify half page jumping to keep cursor in the middle
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")
-- modify search result jumping to keep cursor in the middle
vim.keymap.set("n", "n", "nzzzv")
vim.keymap.set("n", "N", "Nzzzv")

-- paste w/o copying what is being pasted over
vim.keymap.set("x", "<leader>p", "\"_dP")

-- sys clipboard yank
vim.keymap.set("n", "<leader>y", "\"+y")
vim.keymap.set("v", "<leader>y", "\"+y")
vim.keymap.set("n", "<leader>Y", "\"+Y")

-- delete without copy
vim.keymap.set("n", "<leader>d", "\"_d")
vim.keymap.set("v", "<leader>d", "\"_d")

-- intelliJ compatiblity remap for ctrl+c
vim.keymap.set("i", "<C-c>", "<Esc>")

-- just dont
vim.keymap.set("n", "Q", "<nop>")
-- new tmux session
vim.keymap.set("n", "<C-f>", "<cmd>silent !tmux neww tmux-sessionizer<CR>")
-- format code
vim.keymap.set("n", "<leader>f", '<cmd>lua vim.lsp.buf.format({async = true})<cr>', { buffer = true })

-- quickfix list
vim.keymap.set("n", "<C-k>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-j>", "<cmd>cprev<CR>zz")
vim.keymap.set("n", "<leader>k", "<cmd>lnext<CR>zz")
vim.keymap.set("n", "<leader>j", "<cmd>lprev<CR>zz")

-- make file executable
vim.keymap.set("n", "<leader>x", "<cmd>!chmod +x %<CR>")
