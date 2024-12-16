return {
  {
    'folke/tokyonight.nvim',
    enabled = false,
    lazy = false,
    priority = 1000,
    opts = {},
    init = function()
      vim.cmd.colorscheme 'tokyonight-night'
    end,
  },
  {
    'catppuccin/nvim',
    enabled = true,
    lazy = false,
    name = 'catppuccin',
    priority = 1000,
    init = function()
      vim.cmd.colorscheme 'catppuccin-mocha'
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
