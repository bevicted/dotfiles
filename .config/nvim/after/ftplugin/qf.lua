vim.keymap.set('n', 'X', function()
  vim.fn.setqflist(
    vim.fn.filter(vim.fn.getqflist(), function(idx)
      return idx ~= vim.fn.line '.' - 1
    end),
    'r'
  )
end)
