return {
  {
    'nvim-telescope/telescope.nvim',
    event = 'VimEnter',
    branch = '0.1.x',
    dependencies = {
      'nvim-lua/plenary.nvim',
      { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' },
      { 'nvim-telescope/telescope-ui-select.nvim' },
      { 'nvim-tree/nvim-web-devicons', enabled = vim.g.have_nerd_font },
    },
    config = function()
      local common_opts = {
        file_ignore_patterns = {
          '.git/',
          'node_modules/',
          '.venv/',
          '.godot/',
          '.obsidian/',
        },
        layout_strategy = 'vertical',
        layout_config = {
          height = { padding = 0 },
          width = { padding = 0 },
          mirror = true,
          prompt_position = 'top',
        },
        prompt_title = '',
        results_title = '',
        preview_title = '',
        borderchars = {
          prompt = { '', '', '─', '', '', '', '─', '─' },
          results = { '', '', '─', '', '', '', '─', '─' },
          preview = { '', '', '─', '', '', '', '─', '─' },
        },
        sorting_strategy = 'ascending',
      }
      local get_common_opts = function(...)
        return vim.tbl_extend('force', common_opts, ...)
      end
      local with_previewer = function(builtin, opts)
        opts = opts or {}
        opts['previewer'] = true
        return function()
          return builtin(get_common_opts(opts))
        end
      end
      local without_previewer = function(builtin, opts)
        opts = opts or {}
        opts['previewer'] = false
        return function()
          return builtin(get_common_opts(opts))
        end
      end

      require('telescope').setup {
        defaults = common_opts,
        pickers = {
          find_files = {
            hidden = true,
            no_ignore = true,
          },
          grep_string = {
            additional_args = { '--hidden' },
          },
          live_grep = {
            additional_args = { '--hidden' },
          },
        },
        extensions = {
          ['ui-select'] = {
            require('telescope.themes').get_dropdown(),
          },
          fzf = {},
        },
      }

      -- Enable Telescope extensions if they are installed
      pcall(require('telescope').load_extension, 'fzf')
      pcall(require('telescope').load_extension, 'ui-select')

      ---@param lhs string           Left-hand side |{lhs}| of the mapping.
      ---@param rhs string|function  Right-hand side |{rhs}| of the mapping, can be a Lua function.
      ---@param desc string          Description.
      local set = function(lhs, rhs, desc)
        vim.keymap.set('n', lhs, rhs, { desc = desc })
      end
      local builtin = require 'telescope.builtin'

      set('<leader>fh', with_previewer(builtin.help_tags), '[f]ind [h]elp')
      set('<leader>fk', with_previewer(builtin.keymaps), '[f]ind [k]eymap')
      set('<leader>ff', without_previewer(builtin.find_files), '[f]ind [f]ile')
      set('<leader>fw', with_previewer(builtin.grep_string), '[f]ind current [w]ord')
      set('<leader>fg', with_previewer(builtin.live_grep), '[f]ind by [g]rep')
      set('<leader>fd', with_previewer(builtin.diagnostics), '[f]ind [d]iagnostics')
      set('<leader>fr', with_previewer(builtin.resume), '[f]ind [r]esume')
      set('<leader>f.', without_previewer(builtin.oldfiles), '[f]ind [.] recent file')
      set('<leader>fb', with_previewer(builtin.buffers), '[f]ind [b]uffer')
      set('<leader>/', without_previewer(builtin.current_buffer_fuzzy_find), '[/] fuzzy find')
      set('<leader>f/', with_previewer(builtin.live_grep, { grep_open_files = true }), '[f]ind by grep in open files')
      set('<leader>fc', without_previewer(builtin.find_files, { cwd = vim.fn.stdpath 'config' }), '[f]ind [c]onfig')
      ---@diagnostic disable-next-line: param-type-mismatch
      set('<leader>fp', without_previewer(builtin.find_files, { cwd = vim.fs.joinpath(vim.fn.stdpath 'data', 'lazy') }), '[f]ind [p]lugin files')
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
