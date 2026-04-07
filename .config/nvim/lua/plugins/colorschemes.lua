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
    config = function()
      require('catppuccin').setup {
        integrations = {
          blink_cmp = true,
          fidget = true,
          gitsigns = true,
          mason = true,
          mini = { enabled = true },
          native_lsp = {
            enabled = true,
            underlines = {
              errors = { 'undercurl' },
              hints = { 'undercurl' },
              warnings = { 'undercurl' },
              information = { 'undercurl' },
            },
          },
          semantic_tokens = true,
          telescope = { enabled = true },
          treesitter = true,
        },
        custom_highlights = function(colors)
          return {
            ['@variable.member'] = { fg = colors.lavender },
            ['@property'] = { fg = colors.lavender },
            ['@module'] = { fg = colors.lavender },
            ['@variable.parameter'] = { fg = colors.maroon },
            ['@constant.builtin'] = { fg = colors.peach, style = { 'bold' } },
            ['@function.builtin'] = { fg = colors.peach, style = { 'italic' } },
            ['@type.builtin'] = { fg = colors.yellow, style = { 'bold' } },
            ['@keyword.return'] = { fg = colors.mauve, style = { 'bold' } },
            ['@function.call'] = { fg = colors.blue },
            ['@function.method.call'] = { fg = colors.blue },
            ['@constructor'] = { fg = colors.sapphire },
            ['@punctuation.bracket'] = { fg = colors.overlay2 },
            ['@punctuation.delimiter'] = { fg = colors.overlay2 },
          }
        end,
      }
      vim.cmd.colorscheme 'catppuccin-mocha'
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
