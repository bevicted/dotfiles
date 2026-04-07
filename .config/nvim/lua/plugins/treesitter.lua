return {
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    build = ':TSUpdate',
    config = function()
      local ts = require 'nvim-treesitter'
      ts.setup()

      local wanted = {
        'bash',
        'c',
        'go',
        'gomod',
        'gosum',
        'json',
        'lua',
        'markdown',
        'markdown_inline',
        'python',
        'query',
        'rust',
        'toml',
        'vim',
        'vimdoc',
        'yaml',
      }

      local installed = ts.get_installed()
      local to_install = vim.tbl_filter(function(lang)
        return not vim.list_contains(installed, lang)
      end, wanted)

      if #to_install > 0 then
        ts.install(to_install)
      end

      vim.api.nvim_create_autocmd('FileType', {
        callback = function(args)
          local max_filesize = 100 * 1024 -- 100 KB
          local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(args.buf))
          if ok and stats and stats.size > max_filesize then
            vim.treesitter.stop(args.buf)
            return
          end
          pcall(vim.treesitter.start, args.buf)
        end,
      })
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
