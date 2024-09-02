pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use std::str::FromStr;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("294LgZBjjo3nbpWF7qxXxK6Wk3dTVtV2vEL9aziZ92To");

#[program]
pub mod game {
    use super::*;

    pub fn new_game(
        context: Context<StartGame>,
        id: u64,
        timeframe: u64,
        bet_amount: u64,
        prediction: bool,
    ) -> Result<()> {
        // Validate that the timeframe is not less than 60
        if timeframe < 60 {
            return Err(GameError::InvalidTimeframe.into());
        }

        emit!(GameCreated {
            id,
            player: context.accounts.player.key()
        });

        instructions::create_game::transfer_bet(&context, bet_amount)?;
        instructions::create_game::start_game(context, id, timeframe, bet_amount, prediction)?;

        Ok(())
    }

    pub fn settle_game(
        context: Context<SettleGame>,
        id: u64,
        result: bool,
        amount_won: u64,
    ) -> Result<()> {
        // Check if the caller is the game vault
        let game_vault_pubkey = Pubkey::from_str(GAME_VAULT).unwrap();

        require_keys_eq!(
            context.accounts.game_vault.key(),
            game_vault_pubkey,
            GameError::SettlerNotGameVault
        );

        emit!(GameSettled {
            id,
            result,
            amount_won
        });

        instructions::settle_game::pay_winnings(&context, amount_won)?;
        instructions::settle_game::end_game(context, id, result, amount_won)?;

        Ok(())
    }
}

#[event]
pub struct GameCreated {
    pub id: u64,
    pub player: Pubkey,
}

#[event]
pub struct GameSettled {
    pub id: u64,
    pub result: bool,
    pub amount_won: u64,
}
