return {
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    build = ':TSUpdate',
    config = function()
      require('nvim-treesitter').setup {
        ensure_installed = {
          'c',
          'go',
          'lua',
          'markdown',
          'markdown_inline',
          'query',
          'vim',
          'vimdoc',
        },
      }

      -- Disable treesitter highlighting for large files
      vim.api.nvim_create_autocmd('FileType', {
        callback = function(args)
          local max_filesize = 100 * 1024 -- 100 KB
          local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(args.buf))
          if ok and stats and stats.size > max_filesize then
            vim.treesitter.stop(args.buf)
          end
        end,
      })
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
