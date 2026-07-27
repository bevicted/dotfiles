return {
  {
    'ThePrimeagen/99',
    dependencies = {
      'saghen/blink.cmp',
      { 'saghen/blink.compat', version = '2.*' },
      'nvim-telescope/telescope.nvim',
    },
    config = function()
      local _99 = require '99'

      local cwd = (vim.uv or vim.loop).cwd()
      local basename = vim.fs.basename(cwd)

      _99.setup {
        provider = _99.Providers.ClaudeCodeProvider,
        logger = {
          level = _99.DEBUG,
          path = '/tmp/' .. basename .. '.99.debug',
          print_on_error = true,
        },
        tmp_dir = './tmp',
        completion = {
          source = 'blink',
        },
        md_files = {
          'CLAUDE.md',
        },
      }

      vim.keymap.set('v', '<leader>9v', function()
        _99.visual()
      end, { desc = '[9] visual selection op' })

      vim.keymap.set('n', '<leader>9s', function()
        _99.search()
      end, { desc = '[9] search project' })

      vim.keymap.set('n', '<leader>9x', function()
        _99.stop_all_requests()
      end, { desc = '[9] cancel all requests' })

      vim.keymap.set('n', '<leader>9m', function()
        require('99.extensions.telescope').select_model()
      end, { desc = '[9] select model' })

      vim.keymap.set('n', '<leader>9p', function()
        require('99.extensions.telescope').select_provider()
      end, { desc = '[9] select provider' })
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
