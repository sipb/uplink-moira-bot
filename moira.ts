import soap from 'soap';
import fs from 'fs';
import https from 'https';

const api_url = 'https://moiraws.mit.edu/moiraws/services/moira?wsdl';

type MemberType = 'USER' | 'LIST' | 'STRING' | 'KERBEROS';

interface ListMember {
    list: string;
    member: string;
    type: MemberType;
}

interface ListAttributes {
    aceName: string;
    aceType: MemberType;
    activeList: boolean;
    description: string;
    gid: string;
    group: boolean;
    hiddenList: boolean;
    listName: string;
    mailList: boolean;
    mailman: boolean;
    mailmanServer: string;
    memaceName: string;
    memaceType: MemberType;
    modby: string;
    modtime: string;
    modwith: string;
    nfsgroup: boolean;
    pacsList: boolean;
    publicList: boolean;
}

interface UserAttributes {
    comment: string;
    created: string;
    creator: string;
    first: string;
    last: string;
    middle: string;
    mitid: string;
    modby: string;
    modtime: string;
    modwith: string;
    secure: string;
    shell: string;
    signature: string;
    state: string;
    uclass: string;
    uid: string;
    userName: string;
    winconsoleshell: string;
    winhomedir: string;
    winprofiledir: string;
}

class NoAPIResult extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NoAPIResult';
    }
}

export class Moira {
    /// https://dev.to/somedood/the-proper-way-to-write-async-constructors-in-javascript-1o8c

    #client: soap.Client;
    
    private constructor(client: soap.Client) {
        this.#client = client;
    }

    /**
     * Construct a Moira API
     * @param key Path to key for certificate authentication
     * @param cert Path to cert for certificate authentication
     */
    static async initialize(key: string, cert: string): Promise<Moira> {
        const client = await soap.createClientAsync(api_url, {
            wsdl_options: {
                httpsAgent: new https.Agent({
                    key: fs.readFileSync(key),
                    cert: fs.readFileSync(cert),
                }),
            }
        });
        const moira = new Moira(client);
        moira.#client.setSecurity(new soap.ClientSSLSecurity(key, cert));
        return moira;
    }

    /**
     * Print all API calls available, even the ones that don't have an explicit function defined
     */
    async printAllAPICalls() {
        console.log(this.#client.describe().moiraService.moira);
    }

    private async apiCall(method: string, args: object) {
        const result = await this.#client[method + 'Async'](args);
        if (result[0] == null) {
            throw new NoAPIResult(`${method} didn't return anything!`);
        }
        return result[0][method + 'Return'];
    }

    /**
     * Get all members of a mailing list
     * @param listName name of the mailing list
     * @param recursiveSearch whether to return the members of sublists and so on
     * @returns members of the mailing list
     */
    async getMembersOfList(listName: string, recursiveSearch: Boolean = false): Promise<ListMember[]> {
        return await this.apiCall('getListMembership', {
            // memberType: 'USER' // can omit this
            listName: listName,
            recursiveSearch: recursiveSearch,
            maxReturnCount: 0, // looks like setting it to 0 sets it to infinite/no limit
        });
    }

    /**
     * Get all kerbs that belong on a given mailing list
     * @param listName name of the mailing list
     * @returns list of kerbs (username without @mit.edu) in the mailing list
     */
    async getMITMembersOfList(listName: string): Promise<string[]> {
        const allMembers = await this.getMembersOfList(listName, true);
        
        const filterByType = (type: MemberType) => allMembers.filter((member) => member.type == type).map((member) => member.member);
        
        // In Python, this would be a list comprehension
        const kerbs = filterByType('USER');

        // Credit: https://github.com/sipb/uplink/blob/master/moira_interface/mailing_list_csv_to_json.py
        const athenaUsers: string[] = [];
        for (const user of filterByType('KERBEROS')) {
            if (user.includes('/')) {
                const [kerb, extension] = user.split('/');
                if (extension == 'root@ATHENA.MIT.EDU') {
                    athenaUsers.push(kerb);
                }
            } else {
                const [kerb, extension] = user.split('@');
                if (extension == 'ATHENA.MIT.EDU' || extension == 'MIT.EDU') {
                    athenaUsers.push(kerb);
                }
            }
        }
        
        return kerbs.concat(athenaUsers);
    }

    async getListAttributes(listName: string) : Promise<ListAttributes> {
        return (await this.apiCall('getListAttributes', {
            listName: listName,
        }))[0];
    }

    async getUserAttributes(kerb: string): Promise<UserAttributes> {
        const attributes = (await this.apiCall('getUserAttributes', {
            memberID: kerb,
        }))[0];
        return attributes;
    }

    async getUserName(kerb: string): Promise<string> {
        const attributes = await this.getUserAttributes(kerb);
        return `${attributes.first} ${attributes.middle} ${attributes.last}`.replace('  ', ' ');
    }

    async getUserLists(kerb: string): Promise<string[]> {
        return await this.apiCall('getUserLists', {
            memberID: kerb,
            memberType: 'USER',
        });
    }

    async getUserClasses(kerb: string): Promise<string[]> {
        const lists = await this.getUserLists(kerb);
        // TODO: parse and create a new Class class or something
        return lists.filter((name) => name.startsWith('canvas'));
    }
}