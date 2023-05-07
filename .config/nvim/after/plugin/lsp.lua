local lsp = require('lsp-zero').preset({})

lsp.ensure_installed({
    'lua_ls',
    'bashls',
    'shellcheck',
    'rust_analyzer',
})

local cmp = require('cmp')
local cmp_select = { behavior = cmp.SelectBehavior.Select }
local cmp_mappings = lsp.defaults.cmp_mappings({
    ['<C-p>'] = cmp.mapping.select_prev_item(cmp_select),
    ['<C-n>'] = cmp.mapping.select_next_item(cmp_select),
    ['<C-y>'] = cmp.mapping.confirm({ select = true }),
    ["<C-Space>"] = cmp.mapping.complete(),
})

-- lsp.set_preferences({
--  sign_icons = { }
-- })

lsp.setup_nvim_cmp({
    mapping = cmp_mappings
})

lsp.on_attach(function(client, bufnr)
    lsp.default_keymaps({ buffer = bufnr })
    local opts = { buffer = bufnr, remap = false }

    vim.keymap.set("n", "<leader>ws", '<cmd>lua vim.lsp.buf.workspace_symbol()<cr>', opts)
    vim.keymap.set("i", "<C-s>", '<cmd>lua vim.lsp.buf.signature_help()<cr>', opts)

    lsp.buffer_autoformat()
end)

-- (Optional) Configure lua language server for neovim
require('lspconfig').lua_ls.setup(lsp.nvim_lua_ls())

lsp.setup()
