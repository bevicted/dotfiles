return {
    "mbbill/undotree",
    keys = {
        { "<leader>u", vim.cmd.UndotreeToggle },
    },
    config = function()
        vim.g.undotree_SetFocusWhenToggle = 1
    end,
}
