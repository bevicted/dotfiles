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
      desc = '[O]tter Activate',
    },
  },
}
