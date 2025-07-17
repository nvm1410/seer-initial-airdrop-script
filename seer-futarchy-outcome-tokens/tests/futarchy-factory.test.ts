import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, Bytes } from "@graphprotocol/graph-ts"
import { ExampleEntity } from "../generated/schema"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { handleNewProposal } from "../src/futarchy-factory"
import { createNewProposalEvent } from "./futarchy-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let proposal = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let marketName = "Example string value"
    let conditionId = Bytes.fromI32(1234567890)
    let questionId = Bytes.fromI32(1234567890)
    let newNewProposalEvent = createNewProposalEvent(
      proposal,
      marketName,
      conditionId,
      questionId
    )
    handleNewProposal(newNewProposalEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("ExampleEntity created and stored", () => {
    assert.entityCount("ExampleEntity", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "ExampleEntity",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "proposal",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "ExampleEntity",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "marketName",
      "Example string value"
    )
    assert.fieldEquals(
      "ExampleEntity",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "conditionId",
      "1234567890"
    )
    assert.fieldEquals(
      "ExampleEntity",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "questionId",
      "1234567890"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
