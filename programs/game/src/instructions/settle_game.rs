use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::str::FromStr;

use crate::constants::GAME_VAULT;
use crate::GameResult;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct SettleGame<'info> {
    /// CHECK: game vault is the one who creates the game result
    #[account(mut)]
    pub player: AccountInfo<'info>,

    #[account(
        init,
        payer = game_vault,
        space = 8 + GameResult::INIT_SPACE,
        seeds = [b"game_result", id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_result: Account<'info, GameResult>,

    /// CHECK: This is the game vault account
    #[account(mut, address = Pubkey::from_str(GAME_VAULT).unwrap())]
    pub game_vault: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn end_game(ctx: Context<SettleGame>, id: u64, result: bool, amount_won: u64) -> Result<()> {
    ctx.accounts.game_result.set_inner(GameResult {
        game_id: id,
        player: ctx.accounts.player.key(),
        result,
        amount_won,
        bump: ctx.bumps.game_result,
    });

    Ok(())
}

pub fn pay_winnings(ctx: &Context<SettleGame>, amount_won: u64) -> Result<()> {
    // Transfer winnings to player if amount_won > 0
    if amount_won > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.game_vault.to_account_info(),
                to: ctx.accounts.player.to_account_info(),
            },
        );

        system_program::transfer(cpi_context, amount_won)?;
    }

    Ok(())
}
