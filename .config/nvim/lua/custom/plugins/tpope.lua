return {
  {
    'tpope/vim-fugitive',
    event = 'VimEnter',
    keys = {
      { '<leader>vf', '<cmd>Git<cr>', desc = '[V]im [F]ugitive - Git' },
      { '<leader>vb', '<cmd>Git blame -wCCC<cr>', desc = '[V]im Fugitive - Git [B]lame' },
      { '<leader>vB', '<cmd>GBrowse<cr>', desc = '[V]im Fugitive - Git [B]rowse' },
    },
  },
  {
    'tpope/vim-rhubarb',
    config = function()
      vim.g.github_enterprise_urls = { 'https://github.ibm.com' }
    end,
  },
  { 'tpope/vim-sleuth', lazy = false },
}

-- vim: ts=2 sts=2 sw=2 et
