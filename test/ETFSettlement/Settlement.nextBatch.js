const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, parseAbi, decodeEventLog } = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldMoveToNextBatch() {
  it("should change state after moveToNextBatch call", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB, publicClient } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

    await mockSymm.write.approve([etfSettlement.address, partyACollateral], {
      account: partyA.account,
    });
    await mockSymm.write.approve([etfSettlement.address, partyBCollateral], {
      account: partyB.account,
    });

    const etfParams = {
      priceMint: parseEther("1000"),
      mintTime: BigInt(Math.floor(Date.now() / 1000)),
      etfTokenAmount: parseEther("10"),
      etfToken: mockWeth.address, // Use deployed mockWeth
      interestRate: parseEther("0.05"),
      interestRatePayer: partyA.account.address,
    };

    const settlementId = await etfSettlement.write.createETFSettlement(
      [
        partyA.account.address,
        partyB.account.address,
        partyACollateral,
        partyBCollateral,
        mockSymm.address,
        etfParams,
      ],
      {
        account: partyA.account,
      }
    );

    const moveToNextBatchReceipt = await publicClient.waitForTransactionReceipt(
      {
        hash: await etfSettlement.write.moveToNextBatch([settlementId], {
          account: partyA.account,
        }),
      }
    );

    const movedToNextBatchLog = decodeEventLog({
      abi: parseAbi(["event MovedToNextBatch(bytes32 indexed settlementId)"]),
      data: moveToNextBatchReceipt.logs[0].data,
      topics: moveToNextBatchReceipt.logs[0].topics,
    });

    assert.equal(
      movedToNextBatchLog.args.settlementId,
      settlementId,
      "Incorrect settlementId in MovedToNextBatch event"
    );

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);
    const isScheduled = await etfSettlement.read.isScheduledForNextBatch([
      settlementId,
    ]);

    assert.equal(settlement.state, 2);
    assert.equal(isScheduled, true);
  });
}

module.exports = {
  shouldMoveToNextBatch,
};
