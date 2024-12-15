return {
  {
    'tpope/vim-rhubarb',
    dependencies = {
      {
        'tpope/vim-fugitive',
        keys = {
          { '<leader>gf', '<cmd>Git<cr>', desc = '[g]it [f]ugitive' },
          { '<leader>gb', '<cmd>Git blame -wCCC<cr>', desc = '[g]it [b]lame' },
        },
      },
    },
    keys = {
      { '<leader>gB', '<cmd>GBrowse<cr>', desc = '[g]it [B]rowse' },
    },
    config = function()
      vim.g.github_enterprise_urls = { vim.g.ghe_url }
    end,
  },
  { 'tpope/vim-sleuth' },
}

-- vim: ts=2 sts=2 sw=2 et
