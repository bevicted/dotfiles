{ ... }:

{
  programs.gitui = {
    enable = true;
    catppuccin.enable = true;

    keyConfig = ''
(
    move_left: Some(( code: Char('h'), modifiers: "")),
    move_right: Some(( code: Char('l'), modifiers: "")),
    move_up: Some(( code: Char('k'), modifiers: "")),
    move_down: Some(( code: Char('j'), modifiers: "")),

    open_help: Some(( code: Char('?'), modifiers: "")),

    popup_up: Some(( code: Char('p'), modifiers: "CONTROL")),
    popup_down: Some(( code: Char('n'), modifiers: "CONTROL")),
    page_up: Some(( code: Char('u'), modifiers: "CONTROL")),
    page_down: Some(( code: Char('d'), modifiers: "CONTROL")),
    home: Some(( code: Char('g'), modifiers: "")),
    end: Some(( code: Char('G'), modifiers: "SHIFT")),
    shift_up: Some(( code: Char('K'), modifiers: "SHIFT")),
    shift_down: Some(( code: Char('J'), modifiers: "SHIFT")),

    edit_file: Some(( code: Char('I'), modifiers: "SHIFT")),

    status_reset_item: Some(( code: Char('X'), modifiers: "SHIFT")),

    diff_reset_lines: Some(( code: Char('x'), modifiers: "")),
    diff_stage_lines: Some(( code: Char('a'), modifiers: "")),

    stashing_save: Some(( code: Char('w'), modifiers: "")),
    stashing_toggle_index: Some(( code: Char('m'), modifiers: "")),

    stash_open: Some(( code: Char('l'), modifiers: "")),

    abort_merge: Some(( code: Char('M'), modifiers: "SHIFT")),
)
    '';
  };
}
