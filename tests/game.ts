import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { assert } from 'chai';
import { Game } from '../target/types/game';
import { makeKeypairs } from '@solana-developers/helpers';

dotenv.config();

const getRandomBigNumber = (size = 8) => {
  const rb = randomBytes(size);
  return new BN(rb);
};

const GAME_VAULT = '2Z43jM1KjKk18o7BeYydoVRv5UV73LxGFigwK21aynPd';
const gameVaultKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.VAULT_PRIVATE_KEY)),
);

if (gameVaultKeypair.publicKey.toString() !== GAME_VAULT) {
  throw new Error('VAULT_PRIVATE_KEY does not match GAME_VAULT');
}

let globalPlayer1Balance: number;

describe('game', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const player0 = (provider.wallet as anchor.Wallet).payer;
  const [player1] = makeKeypairs(2);

  const program = anchor.workspace.Game as anchor.Program<Game>;
  let gameIds: anchor.BN[] = [];

  before('Init', async () => {
    const sendSolInstructions: Array<TransactionInstruction> = [
      player1,
      gameVaultKeypair,
    ].map((account) =>
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: account.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      }),
    );
    const tx = new Transaction();
    tx.instructions = [...sendSolInstructions];
    await provider.sendAndConfirm(tx);
  });

  it('Can player0 start a game', async () => {
    const gameId = getRandomBigNumber();
    gameIds.push(gameId);
    console.log('gameId', gameId);
    console.log('player0.publicKey', player0.publicKey.toString());

    const timeframe = new BN(60); // 1 minute
    const betAmount = new BN(420_000_000); // 0.42 SOL
    const prediction = true; // Predicting price will go up

    const gamePDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from('game'),
        player0.publicKey.toBuffer(),
        gameId.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId,
    )[0];

    const transactionSignature = await program.methods
      .newGame(gameId, timeframe, betAmount, prediction)
      .accounts({
        player: player0.publicKey,
        game: gamePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([player0])
      .rpc();

    console.log('transactionSignature', transactionSignature);

    const gameAccount = await program.account.game.fetch(gamePDA);

    assert.equal(gameAccount.player.toBase58(), player0.publicKey.toBase58());
    assert.equal(gameAccount.betAmount.toNumber(), betAmount.toNumber());
    assert.equal(gameAccount.prediction, prediction);
    // Check if the GAME_VAULT has received the betAmount
    const gameVaultPublicKey = new PublicKey(GAME_VAULT);
    const gameVaultBalance = await provider.connection.getBalance(
      gameVaultPublicKey,
    );
    const expectedBalance = betAmount.toNumber();
    console.log('gameVaultBalance', gameVaultBalance);
    console.log('expectedBalance', expectedBalance);
    assert.isAtLeast(
      gameVaultBalance,
      expectedBalance,
      'GAME_VAULT should have received the bet amount',
    );
  });

  it('Can player1 start a game', async () => {
    const gameId = getRandomBigNumber();
    gameIds.push(gameId);
    console.log('gameId', gameId);
    console.log('player1.publicKey', player1.publicKey.toString());

    const timeframe = new BN(60); // 1 minute
    const betAmount = new BN(1_000_000_000); // 1 SOL
    const prediction = true; // Predicting price will go up

    const gamePDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from('game'),
        player1.publicKey.toBuffer(),
        gameId.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId,
    )[0];

    const transactionSignature = await program.methods
      .newGame(gameId, timeframe, betAmount, prediction)
      .accounts({
        player: player1.publicKey,
        game: gamePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([player1])
      .rpc();

    console.log('transactionSignature', transactionSignature);

    const gameAccount = await program.account.game.fetch(gamePDA);

    assert.equal(gameAccount.player.toBase58(), player1.publicKey.toBase58());
    assert.equal(gameAccount.betAmount.toNumber(), betAmount.toNumber());
    assert.equal(gameAccount.prediction, prediction);

    const player1Balance = await provider.connection.getBalance(
      player1.publicKey,
    );
    console.log('player1Balance', player1Balance);
    globalPlayer1Balance = player1Balance;
  });

  it('Can game vault settle a winning game', async () => {
    const gameWon = true;
    const amountWon = new BN(10_000_000); // 0.01 SOL
    const gameId = gameIds[1];
    console.log('gameId', gameId);

    const gameResultPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('game_result'), gameId.toArrayLike(Buffer, 'le', 8)],
      program.programId,
    )[0];

    console.log('gameResultPDA', gameResultPDA.toString());

    const transactionSignature = await program.methods
      .settleGame(gameId, gameWon, amountWon)
      .accounts({
        player: player1.publicKey,
        gameResult: gameResultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([gameVaultKeypair])
      .rpc();

    console.log('transactionSignature', transactionSignature);

    const gameResultAccount = await program.account.gameResult.fetch(
      gameResultPDA,
    );
    console.log('gameResultAccount', gameResultAccount);

    assert.equal(gameResultAccount.gameId.toString(), gameId.toString());
    assert.equal(gameResultAccount.result, gameWon);
    assert.equal(gameResultAccount.amountWon.toNumber(), amountWon.toNumber());
    const player1Balance = await provider.connection.getBalance(
      player1.publicKey,
    );
    console.log('player1Balance', player1Balance);
    assert.equal(player1Balance, globalPlayer1Balance + amountWon.toNumber());
  });

  it('Fails to settle a game by unathorized signer', async () => {
    const gameWon = true;
    const amountWon = new BN(10_000_000); // 0.01 SOL
    const gameId = gameIds[0];
    console.log('gameId', gameId);

    const gameResultPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('game_result'), gameId.toArrayLike(Buffer, 'le', 8)],
      program.programId,
    )[0];

    console.log('gameResultPDA', gameResultPDA.toString());

    try {
      const transactionSignature = await program.methods
        .settleGame(gameId, gameWon, amountWon)
        .accounts({
          player: player0.publicKey,
          gameResult: gameResultPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player0]) // this should fail the test
        .rpc();

      console.log('transactionSignature', transactionSignature);
    } catch (e) {
      assert.include(e.message, 'Signature verification failed');
    }
  });
});
