use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::str::FromStr;

use crate::Game;
use crate::constants::GAME_VAULT;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init,
        payer = player,
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", player.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,

    /// CHECK: This is the game vault account
    #[account(mut, address = Pubkey::from_str(GAME_VAULT).unwrap())]
    pub game_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn start_game(
    ctx: Context<StartGame>,
    id: u64,
    timeframe: u64,
    bet_amount: u64,
    prediction: bool,
) -> Result<()> {
    let clock: Clock = Clock::get()?;

    ctx.accounts.game.set_inner(Game {
        id,
        player: ctx.accounts.player.key(),
        start_time: clock.unix_timestamp as u64,
        end_time: clock.unix_timestamp as u64 + timeframe,
        bet_amount,
        prediction,
        bump: ctx.bumps.game,
    });


    Ok(())
}

pub fn transfer_bet(ctx: &Context<StartGame>, bet_amount: u64) -> Result<()> {
    // Transfer bet amount from player to vault
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.player.to_account_info(),
            to: ctx.accounts.game_vault.to_account_info(),
        },
    );

    system_program::transfer(cpi_context, bet_amount)?;

    Ok(())
}