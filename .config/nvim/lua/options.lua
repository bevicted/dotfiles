-- [[ options ]]
-- NOTE: For more options, you can see `:help option-list`
--  see also: `:help vim.opt / vim.o / vim.wo / vim.g / ...`

-- [ cursor ]

vim.opt.cursorline = true
vim.opt.cursorlineopt = 'number'
vim.opt.guicursor = ''

-- [ line numbers ]

vim.wo.number = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.o.statuscolumn = '%s %l %r'

-- [ indent ]

vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.smartindent = true

-- [ undo/swap ]
-- swap nerfed in favor of undotree

vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv 'HOME' .. '/.vim/undodir'
vim.opt.undofile = true

-- [ search ]

vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- [ substitute ]

vim.opt.inccommand = 'split'

-- [ wrap ]

vim.opt.wrap = false
vim.opt.breakindent = true

-- [ netrw ]

vim.g.netrw_browse_split = 0
vim.g.netrw_banner = 0
vim.g.netrw_winsize = 25

-- [ display ]

vim.opt.termguicolors = true
vim.opt.isfname:append '@-@'
-- vim.opt.colorcolumn = { "80", "100" }
vim.opt.showmode = false
vim.opt.signcolumn = 'yes'
vim.opt.updatetime = 250
vim.opt.list = true
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
vim.opt.scrolloff = 10

-- [ splits ]

vim.opt.splitright = true
vim.opt.splitbelow = true

-- [ autocomplete ]

vim.opt.completeopt = { 'menu', 'menuone', 'noselect' }

-- [ interaction ]

vim.opt.mouse = 'a'
vim.opt.timeoutlen = 300

-- vim: ts=2 sts=2 sw=2 et
