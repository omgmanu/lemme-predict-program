use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Game {
    pub id: u64,
    pub player: Pubkey,
    pub start_time: u64,
    pub end_time: u64,
    pub bet_amount: u64,
    pub prediction: bool,
    pub bump: u8,
}
