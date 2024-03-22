return {
  {
    'rafaelsq/nvim-goc.lua',
    config = function()
      -- if set, when we switch between buffers, it will not split more than once. It will switch to the existing buffer instead
      vim.opt.switchbuf = 'useopen'

      local goc = require 'nvim-goc'
      goc.setup { verticalSplit = true } -- default to horizontal

      vim.keymap.set('n', '<leader>gcf', goc.Coverage, { silent = true, desc = '[G]o [C]overage [F]ile' }) -- run for the whole File
      vim.keymap.set('n', '<leader>gct', goc.CoverageFunc, { silent = true, desc = '[G]o [C]overage [T]est unit' }) -- run only for a specific Test unit
      vim.keymap.set('n', '<leader>gcc', goc.ClearCoverage, { silent = true, desc = '[G]o [C]overage [C]lear' }) -- clear coverage highlights

      -- If you need custom arguments, you can supply an array as in the example below.
      -- vim.keymap.set('n', '<Leader>gcf', function() goc.Coverage({ "-race", "-count=1" }) end, {silent=true})
      -- vim.keymap.set('n', '<Leader>gct', function() goc.CoverageFunc({ "-race", "-count=1" }) end, {silent=true})

      vim.keymap.set('n', '<leader>gca', goc.Alternate, { silent = true, desc = '[G]o [C]overage [A]lternate' })
      vim.keymap.set('n', '<leader>gcs', goc.AlternateSplit, { silent = true, desc = '[G]o [C]overage [S]plit' }) -- set verticalSplit=true for vertical

      local cf = function(testCurrentFunction)
        local cb = function(path)
          if path then
            -- `xdg-open|open` command performs the same function as double-clicking on the file.
            -- change from `xdg-open` to `open` on MacOSx
            vim.cmd(':silent exec "!open ' .. path .. '"')
          end
        end

        if testCurrentFunction then
          goc.CoverageFunc(nil, cb, 0)
        else
          goc.Coverage(nil, cb)
        end
      end

      -- If you want to open it in your browser, you can use the commands below.
      -- You need to create a callback function to configure which command to use to open the HTML.
      -- On Linux, `xdg-open` is generally used, on MacOSx it's just `open`.
      vim.keymap.set('n', '<leader>gco', cf, { silent = true, desc = '[G]o [C]overage [O]pen' })
      -- vim.keymap.set('n', '<Leader>gcb', function()
      --   cf(true)
      -- end, { silent = true })

      -- default colors
      -- vim.api.nvim_set_hl(0, 'GocNormal', {link='Comment'})
      -- vim.api.nvim_set_hl(0, 'GocCovered', {link='String'})
      -- vim.api.nvim_set_hl(0, 'GocUncovered', {link='Error'})
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
