-- disable netrw at the very start of your init.lua (strongly advised)
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- set termguicolors to enable highlight groups
vim.opt.termguicolors = true

-- remap
local api = require("nvim-tree.api")
vim.keymap.set("n", "<leader>t", function() api.tree.toggle() end)

-- empty setup using defaults
require("nvim-tree").setup()
