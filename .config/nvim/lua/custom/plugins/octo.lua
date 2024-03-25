return {
  'pwntester/octo.nvim',
  dependencies = {
    'nvim-lua/plenary.nvim',
    'nvim-telescope/telescope.nvim',
    'nvim-tree/nvim-web-devicons',
  },
  event = 'VimEnter',
  keys = {
    { '<leader>gh', desc = '[G]it[H]ub' },
    { '<leader>ghp', desc = '[G]it[H]ub [P]R' },
    { '<leader>ghi', desc = '[G]it[H]ub [I]ssue' },
  },
  config = function()
    require('octo').setup {
      default_merge_method = 'squash',
      mappings_disable_default = true,
    }
    local octo_cmds = require('octo.commands').commands

    vim.keymap.set('n', '<leader>gha', octo_cmds.actions, { desc = '[G]it[H]ub [A]ctions' })
    vim.keymap.set('n', '<leader>ghs', function()
      octo_cmds.search('repo:' .. vim.g.squad_repo .. ' ' .. vim.fn.input 'Query: ')
    end, { desc = '[G]it[H]ub [S]earch' })

    vim.keymap.set('n', '<leader>ghpc', octo_cmds.pr.create, { desc = '[G]it[H]ub [P]R [C]reate' })
    vim.keymap.set('n', '<leader>ghpC', octo_cmds.pr.close, { desc = '[G]it[H]ub [P]R [C]lose' })
    vim.keymap.set('n', '<leader>ghpo', octo_cmds.pr.checkout, { desc = '[G]it[H]ub [P]R check[O]ut' })
    vim.keymap.set('n', '<leader>ghpl', octo_cmds.pr.list, { desc = '[G]it[H]ub [P]R [L]ist' })
    vim.keymap.set('n', '<leader>ghpe', function()
      octo_cmds.pr.edit(vim.fn.input 'PR: ')
    end, { desc = '[G]it[H]ub [P]R [E]dit' })

    vim.keymap.set('n', '<leader>ghic', function()
      octo_cmds.issue.create(vim.g.squad_repo)
    end, { desc = '[G]it[H]ub [I]ssue [C]reate' })
    vim.keymap.set('n', '<leader>ghil', function()
      octo_cmds.issue.list(vim.g.squad_repo)
    end, { desc = '[G]it[H]ub [I]ssue [L]ist' })
    vim.keymap.set('n', '<leader>ghie', function()
      octo_cmds.issue.edit(vim.g.squad_repo, vim.fn.input 'Issue: ')
    end, { desc = '[G]it[H]ub [I]ssue [E]dit' })
    vim.keymap.set('n', '<leader>ghiC', octo_cmds.issue.close, { desc = '[G]it[H]ub [I]ssue [C]lose' })
    vim.keymap.set('n', '<leader>ghiR', octo_cmds.issue.reopen, { desc = '[G]it[H]ub [I]ssue [R]eopen' })
    vim.keymap.set('n', '<leader>ghiy', octo_cmds.issue.url, { desc = '[G]it[H]ub [I]ssue [Y]ank URL' })
    vim.keymap.set('n', '<leader>ghib', octo_cmds.issue.browser, { desc = '[G]it[H]ub [I]ssue Open In [B]rowser' })

    vim.keymap.set('n', '<leader>ghca', octo_cmds.comment.add, { desc = '[G]it[H]ub [C]omment [A]dd' })
    vim.keymap.set('n', '<leader>ghcd', octo_cmds.comment.delete, { desc = '[G]it[H]ub [C]omment [D]elete' })

    vim.keymap.set('n', '<leader>ghla', octo_cmds.label.add, { desc = '[G]it[H]ub [L]abel [A]dd' })
    vim.keymap.set('n', '<leader>ghlr', octo_cmds.label.remove, { desc = '[G]it[H]ub [L]abel [R]remove' })
  end,
}

-- vim: ts=2 sts=2 sw=2 et
