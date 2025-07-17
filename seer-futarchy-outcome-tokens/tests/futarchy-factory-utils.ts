import { newMockEvent } from "matchstick-as"
import { ethereum, Address, Bytes } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"

export function createNewProposalEvent(
  proposal: Address,
  marketName: string,
  conditionId: Bytes,
  questionId: Bytes
): NewProposal {
  let newProposalEvent = changetype<NewProposal>(newMockEvent())

  newProposalEvent.parameters = new Array()

  newProposalEvent.parameters.push(
    new ethereum.EventParam("proposal", ethereum.Value.fromAddress(proposal))
  )
  newProposalEvent.parameters.push(
    new ethereum.EventParam("marketName", ethereum.Value.fromString(marketName))
  )
  newProposalEvent.parameters.push(
    new ethereum.EventParam(
      "conditionId",
      ethereum.Value.fromFixedBytes(conditionId)
    )
  )
  newProposalEvent.parameters.push(
    new ethereum.EventParam(
      "questionId",
      ethereum.Value.fromFixedBytes(questionId)
    )
  )

  return newProposalEvent
}
