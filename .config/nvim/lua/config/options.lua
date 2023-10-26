-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- use space as <leader>
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- block cursor
vim.opt.guicursor = ""

-- linenumbers
vim.opt.nu = true
vim.opt.relativenumber = true

-- indent
vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.smartindent = true

-- dont wrap
vim.opt.wrap = false

-- dont use swap, give all power to undotree
vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true

-- dont highlight every search result but use incremental search
vim.opt.hlsearch = false
vim.opt.incsearch = true

-- 24-bit RGB and gui highlight attrs
vim.opt.termguicolors = true

-- Minimal number of screen lines to keep above and below the cursor
vim.opt.scrolloff = 8
-- When and how to draw the signcolumn
vim.opt.signcolumn = "yes"
-- These characters are included in file names and path names
vim.opt.isfname:append("@-@")

-- idle threshold in ms to trigger swap file write to disk
vim.opt.updatetime = 50

-- color columns
vim.opt.colorcolumn = { "80", "100" }

-- winbar
vim.opt.winbar = "%=%m %f"

-- netrw
vim.g.netrw_browse_split = 0
vim.g.netrw_banner = 0
vim.g.netrw_winsize = 25
