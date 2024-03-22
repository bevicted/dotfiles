return {
  {
    'tpope/vim-fugitive',
    keys = {
      { '<leader>vf', '<cmd>Git<cr>', desc = '[V]im [F]ugitive - Git' },
      { '<leader>vb', '<cmd>Git blame -wCCC<cr>', desc = '[V]im Fugitive - Git [B]lame' },
      { '<leader>vB', '<cmd>GBrowse<cr>', desc = '[V]im Fugitive - Git [B]rowse' },
    },
    lazy = false,
  },
  {
    'tpope/vim-rhubarb',
    config = function()
      vim.g.github_enterprise_urls = { 'https://github.ibm.com' }
    end,
    lazy = false,
  },
  { 'tpope/vim-sleuth', lazy = false },
}

-- vim: ts=2 sts=2 sw=2 et
