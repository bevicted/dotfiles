return {
  {
    'tpope/vim-fugitive',
    event = 'VeryLazy',
    keys = {
      { '<leader>vf', '<cmd>Git<cr>', desc = '[V]im [F]ugitive - Git' },
      { '<leader>vb', '<cmd>Git blame -wCCC<cr>', desc = '[V]im Fugitive - Git [B]lame' },
      { '<leader>vB', '<cmd>GBrowse<cr>', desc = '[V]im Fugitive - Git [B]rowse' },
    },
  },
  {
    'tpope/vim-rhubarb',
    config = function()
      vim.g.github_enterprise_urls = { vim.g.ghe_url }
    end,
  },
  { 'tpope/vim-sleuth' },
}

-- vim: ts=2 sts=2 sw=2 et
