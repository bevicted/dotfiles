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
