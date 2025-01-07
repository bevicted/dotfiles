vim.api.nvim_create_autocmd('TermOpen', {
  group = vim.api.nvim_create_augroup('term-open', { clear = true }),
  callback = function()
    vim.opt.number = false
    vim.opt.relativenumber = false
  end,
})

local chanID = 0
vim.keymap.set('n', '<leader>tn', function()
  vim.cmd.vnew()
  vim.cmd.term()
  vim.cmd.startinsert()

  chanID = vim.bo.channel
end)

vim.keymap.set('n', '<space>asd', function()
  vim.fn.chansend(chanID, { 'ls -AltFh\r\n' })
end)
