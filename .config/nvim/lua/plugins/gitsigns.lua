return {
  {
    'lewis6991/gitsigns.nvim',
    opts = {
      signs = {
        add = { text = '+' },
        change = { text = '~' },
        delete = { text = '_' },
        topdelete = { text = '‾' },
        changedelete = { text = '~' },
      },
      on_attach = function(bufnr)
        local gitsigns = require 'gitsigns'

        local function map(mode, l, r, opts)
          opts = opts or {}
          opts.buffer = bufnr
          vim.keymap.set(mode, l, r, opts)
        end

        map('n', ']c', function()
          if vim.wo.diff then
            vim.cmd.normal { ']c', bang = true }
          else
            gitsigns.nav_hunk 'next'
          end
        end, { desc = 'jump to next git [c]hange' })

        map('n', '[c', function()
          if vim.wo.diff then
            vim.cmd.normal { '[c', bang = true }
          else
            gitsigns.nav_hunk 'prev'
          end
        end, { desc = 'jump to previous git [c]hange' })

        map('v', '<leader>hs', function()
          gitsigns.stage_hunk { vim.fn.line '.', vim.fn.line 'v' }
        end, { desc = 'hunk [s]tage' })
        map('v', '<leader>hr', function()
          gitsigns.reset_hunk { vim.fn.line '.', vim.fn.line 'v' }
        end, { desc = 'hunk [r]eset' })
        map('n', '<leader>gA', gitsigns.stage_buffer, { desc = '[g]it [S]tage buffer' })
        map('n', '<leader>gR', gitsigns.reset_buffer, { desc = '[g]it [R]eset buffer' })
        map('n', '<leader>gha', gitsigns.stage_hunk, { desc = '[g]it [h]unk [a]dd' })
        map('n', '<leader>ghr', gitsigns.reset_hunk, { desc = '[g]it [h]unk [r]eset' })
        map('n', '<leader>ghu', gitsigns.undo_stage_hunk, { desc = '[g]it [h]unk [u]unstage' })
        map('n', '<leader>ghp', gitsigns.preview_hunk, { desc = '[g]it [h]unk [p]review' })
        map('n', '<leader>gb', function()
          gitsigns.blame_line { extra_opts = { '-wCCC' } }
        end, { desc = '[g]it [b]lame line' })
        map('n', '<leader>gd', gitsigns.diffthis, { desc = '[g]it [d]iff against index' })
        map('n', '<leader>gD', function()
          gitsigns.diffthis '@'
        end, { desc = '[g]it [D]iff against last commit' })
        map('n', '<leader>tb', gitsigns.toggle_current_line_blame, { desc = '[t]oggle git line blame' })
        map('n', '<leader>td', gitsigns.toggle_deleted, { desc = '[t]oggle [d]eleted' })
      end,
    },
  },
}

-- vim: ts=2 sts=2 sw=2 et
