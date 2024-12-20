return {
  'jmbuhr/otter.nvim',
  dependencies = {
    'nvim-treesitter/nvim-treesitter',
  },
  opts = {},
  keys = {
    {
      '<leader>o',
      function()
        require('otter').activate()
      end,
      desc = '[o]tter activate',
    },
  },
}

-- vim: ts=2 sts=2 sw=2 et
