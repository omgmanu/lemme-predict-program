use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GameResult {
    pub game_id: u64,
    pub player: Pubkey,
    pub result: bool,
    pub amount_won: u64,
    pub bump: u8,
}
