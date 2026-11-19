import type {
	ICredentialType,
	INodeCredentialsDetails,
	NodeParameterValueType,
} from 'n8n-workflow';

import type { INodeUi } from '@/Interface';
import { isEmpty } from '@/app/utils/typesUtils';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useNodeCredentialOptions } from './composables/useNodeCredentialOptions';
import type { ICredentialsResponse } from './credentials.types';

export interface AutoSelectedCredential {
	credentialType: string;
	credential: INodeCredentialsDetails;
}

/**
 * For a node with no credentials set, pick the most recently updated usable
 * credential across its displayed credential types.
 *
 * `overrideCredentials` must match what the host's dropdown renders from, so
 * "nothing to auto-select" and "dropdown is empty" stay the same condition.
 */
export function getAutoSelectedCredential(
	node: INodeUi,
	overrideCredType: NodeParameterValueType = '',
	overrideCredentials?: ICredentialsResponse[],
): AutoSelectedCredential | undefined {
	if (!isEmpty(node.credentials ?? {})) return undefined;

	const nodeTypesStore = useNodeTypesStore();
	const { credentialTypesNodeDescriptionDisplayed } = useNodeCredentialOptions(
		node,
		nodeTypesStore.getNodeType(node.type, node.typeVersion),
		overrideCredType,
		false,
		overrideCredentials,
	);

	const allOptions = credentialTypesNodeDescriptionDisplayed.value.flatMap((type) => type.options);
	// Credentials that reach the node only through the personal route (sharedRoute
	// 'personal') stay listed in the dropdown under "Available to you", but the
	// workflow's project does not own them — auto-assigning one would surprise
	// the project's other members, so only project-route (and global) ones are
	// candidates. Options without a route (host-supplied lists) stay eligible.
	const candidates = allOptions.filter((option) => option.sharedRoute !== 'personal');
	if (candidates.length === 0) return undefined;

	const mostRecent = candidates.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
	return {
		credentialType: mostRecent.type,
		credential: { id: mostRecent.id, name: mostRecent.name },
	};
}

/**
 * Whether the instance supplies the OAuth app (client ID and secret) for this
 * credential type. Required fields the overwrites do not cover stay the user's
 * to fill, so this is a weaker condition than `canOAuthCredentialQuickConnect`.
 *
 * It takes the type, not a name, so it needs no store and lives here rather
 * than in `useCredentialOAuth`.
 */
export function hasManagedOAuthApp(credentialType: ICredentialType | undefined): boolean {
	if (!credentialType || credentialType.__skipManagedCreation) return false;

	const overwrittenProperties = credentialType.__overwrittenProperties ?? [];
	return (
		overwrittenProperties.includes('clientId') && overwrittenProperties.includes('clientSecret')
	);
}
