return {
  'niuiic/code-shot.nvim',
  dependencies = {
    'niuiic/core.nvim',
  },
  config = function()
    local code_shot = require 'code-shot'
    code_shot.setup {
      options = function()
        return {
          '--to-clipboard',
          '--no-round-corner',
          '--no-window-controls',
        }
      end,
    }

    vim.keymap.set({ 'n', 'v' }, '<leader>cs', code_shot.shot, { desc = '[C]ode [S]hot' })
  end,
}

-- vim: ts=2 sts=2 ws=2 et
