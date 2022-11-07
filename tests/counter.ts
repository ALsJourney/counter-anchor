import * as anchor from "@project-serum/anchor";
import {Program} from "@project-serum/anchor";
import {Counter} from "../target/types/counter";
import {expect} from "chai";
import chai from "chai";
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe("counter", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Counter as Program<Counter>;
    const connection = anchor.getProvider().connection;
    let wallet1: anchor.web3.Keypair;
    let wallet2: anchor.web3.Keypair;

    // create and fund wallets before all
    before(async () => {
        wallet1 = await createWallet(connection, 1);
        wallet2 = await createWallet(connection, 1);
        await initializeAccount(program, wallet1);
        await initializeAccount(program, wallet2);
    })

    const createWallet =
        async (connection: anchor.web3.Connection, funds: number): Promise<anchor.web3.Keypair> => {
            const wallet = anchor.web3.Keypair.generate();

            const tx = await connection.requestAirdrop(
                wallet.publicKey,
                anchor.web3.LAMPORTS_PER_SOL * funds
            );

            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: tx
            });

            // Error Handling
            const balance = await connection.getBalance(wallet.publicKey);
            if (balance < funds) {
                throw new Error("Requested amount exceeds target network's airdrop limit")
            }

            return wallet;
        }

    const initializeAccount = async (program: Program<Counter>, authority: anchor.web3.Keypair): Promise<anchor.web3.PublicKey> => {
        const accountKeypair = anchor.web3.Keypair.generate();
        await program.methods.initialize()

            .accounts(
                {
                    myAccount: accountKeypair.publicKey,
                    authority: accountKeypair.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
            .signers([authority, accountKeypair])
            .rpc();
        return accountKeypair.publicKey;
    }

    it("Accounts are initialized correctly.", async() => {
        const accountWallet1Data = await getAllAccountsByAuthority(
            program.account.myAccount, wallet1.publicKey
        );

        expect(accountWallet1Data.length).to.be.eq(1);
        expect(accountWallet1Data[0].account.data.eq(new anchor.BN(0))).to.be.true;

        const accountWallet2Data = await getAllAccountsByAuthority(
            program.account.myAccount, wallet2.publicKey
        );

        expect(accountWallet2Data.length).to.be.eq(1);
        expect(accountWallet2Data[0].account.data.eq(new anchor.BN(0))).to.be.true;

    });



    // Helper function
    const getAllAccountsByAuthority = async (
        accounts: anchor.AccountClient<Counter>,
        authority: anchor.web3.PublicKey
    ) => {
        return await accounts.all([
            {memcmp: {offset: 8, bytes: authority.toBase58()}}
        ])
    }



});
