use anchor_lang::error_code;

#[error_code]
pub enum GameError {
    #[msg("The game should be settled by the game vault")]
    SettlerNotGameVault,
    #[msg("The timeframe should be at least 60 seconds")]
    InvalidTimeframe
}