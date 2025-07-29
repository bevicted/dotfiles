return {
  'smrtrfszm/dataprime.nvim',
  dependencies = { 'nvim-treesitter/nvim-treesitter' },
  config = function(_, _)
    require('dataprime').setup()
  end,
}
