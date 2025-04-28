import { SUBGRAPHS } from "./constants.js";

export async function getPOHVerifiedUsers(chainId) {
    const maxAttempts = 20;
    let attempt = 0;
    let allRequests = [];
    let currentId = undefined;
    while (attempt < maxAttempts) {
        const query = `{
              requests(first: 1000, orderBy: id, orderDirection: asc${currentId ? `, where: {id_gt: "${currentId}",status: "resolved",revocation: false}` : `, where: {status: "resolved",revocation: false}`
            }) {
                id
                requester
                resolutionTime
              }
            }`;
        const results = await fetch(SUBGRAPHS['poh'][chainId], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
            }),
        });
        const json = await results.json();
        const requests = (json?.data?.requests ?? []);
        allRequests = allRequests.concat(requests);

        if (requests[requests.length - 1]?.id === currentId) {
            break;
        }
        if (requests.length < 1000) {
            break; // We've fetched all requests
        }
        currentId = requests[requests.length - 1]?.id;
        attempt++;
    }
    return allRequests
}
export function isPOHVerifiedUserAtTime(requests, user, timestamp) {
    return requests.some(request => request.requester === user && request.resolutionTime <= timestamp)
}