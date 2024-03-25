return {
  {
    'mbbill/undotree',
    keys = {
      { '<leader>u', vim.cmd.UndotreeToggle, desc = '[U]ndotree' },
    },
    config = function()
      vim.g.undotree_SetFocusWhenToggle = 1
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
