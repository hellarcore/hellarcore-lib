'use strict';

const chai = require('chai');
const expect = chai.expect;

const bitcore = require('../../index');
const SimplifiedMNListStore = require('../../lib/deterministicmnlist/SimplifiedMNListStore');
const SimplifiedMNList = require('../../lib/deterministicmnlist/SimplifiedMNList');
const SMNListFixture = require('../fixtures/mnList');
const ChainLock = bitcore.ChainLock;
const QuorumEntry = bitcore.QuorumEntry;
const Networks = bitcore.Networks;

describe('ChainLock', function () {
  let object;
  let str;
  let buf;
  let object2;
  let buf2;
  let str2;
  let expectedHash2;
  let expectedRequestId2;
  let object3;
  let str3;
  let quorumEntryJSON;
  let quorumEntryJSON4;
  let quorum;
  let quorum4;
  let expectedRequestId3;
  let object4;
  let buf4;
  let str4;
  let expectedHash4;
  let expectedRequestId4;

  beforeEach(() => {
    // Output from https://github.com/hellarcore/hellar/pull/3718 PR's description
    object = {
      blockHash:
        '00000105df60caca6a257d8f2f90d422f2d1abf6658555650d5c2c8ecd209e25',
      height: 382312,
      signature:
        '17b7b6008df6725a5b89bd114c89a2d650b3fcb33fc127c29763c15a3cf110d7e32aa5108223b0b31597be0953d37c6c06545ed28e71be7d6420e1b24e54ae66eb40b932f453ddc811af37b38d364bd1a9df7da31c60be4728b84150558516f2',
    };
    str =
      '68d50500259e20cd8e2c5c0d65558565f6abd1f222d4902f8f7d256acaca60df0501000017b7b6008df6725a5b89bd114c89a2d650b3fcb33fc127c29763c15a3cf110d7e32aa5108223b0b31597be0953d37c6c06545ed28e71be7d6420e1b24e54ae66eb40b932f453ddc811af37b38d364bd1a9df7da31c60be4728b84150558516f2';
    buf = Buffer.from(str, 'hex');

    // HellarJ test vectors : https://github.com/hellarcore/hellarj/blob/857b198a34b5cd49b7890d7c4dd3bbd2e6d9cc09/core/src/test/java/org/bitcoinj/quorums/ChainLockTest.java
    str2 =
      'ea480100f4a5708c82f589e19dfe9e9cd1dbab57f74f27b24f0a3c765ba6e007000000000a43f1c3e5b3e8dbd670bca8d437dc25572f72d8e1e9be673e9ebbb606570307c3e5f5d073f7beb209dd7e0b8f96c751060ab3a7fb69a71d5ccab697b8cfa5a91038a6fecf76b7a827d75d17f01496302942aa5e2c7f4a48246efc8d3941bf6c';
    object2 = {
      height: 84202,
      blockHash:
        '0000000007e0a65b763c0a4fb2274ff757abdbd19c9efe9de189f5828c70a5f4',
      signature:
        '0a43f1c3e5b3e8dbd670bca8d437dc25572f72d8e1e9be673e9ebbb606570307c3e5f5d073f7beb209dd7e0b8f96c751060ab3a7fb69a71d5ccab697b8cfa5a91038a6fecf76b7a827d75d17f01496302942aa5e2c7f4a48246efc8d3941bf6c',
    };
    buf2 = Buffer.from(str2, 'hex');
    expectedHash2 =
      'e0b872dbf38b0f6f04fed617bef820776530b2155429024fbb092fc3a6ad6437';
    expectedRequestId2 =
      '5d92e094e2aa582b76e8bf519f42c5e8fc141bbe548e9660726f744adad03966';

    // HellarSync test vectors : https://github.com/hellarcore/hellarsync-iOS/blob/master/Example/Tests/DSChainLockTests.m
    object3 = {
      height: 1177907,
      blockHash: Buffer.from(
        '0000000000000027b4f24c02e3e81e41e2ec4db8f1c42ee1f3923340a22680ee',
        'hex'
      ),
      signature: Buffer.from(
        '8ee1ecc07ee989230b68ccabaa95ef4c6435e642a61114595eb208cb8bfad5c8731d008c96e62519cb60a642c4999c880c4b92a73a99f6ff667b0961eb4b74fc1881c517cf807c8c4aed2c6f3010bb33b255ae75b7593c625e958f34bf8c02be',
        'hex'
      ),
    };
    str3 =
      '33f911000000000000000027b4f24c02e3e81e41e2ec4db8f1c42ee1f3923340a22680ee8ee1ecc07ee989230b68ccabaa95ef4c6435e642a61114595eb208cb8bfad5c8731d008c96e62519cb60a642c4999c880c4b92a73a99f6ff667b0961eb4b74fc1881c517cf807c8c4aed2c6f3010bb33b255ae75b7593c625e958f34bf8c02be';

    quorumEntryJSON = {
      version: 1,
      llmqType: 2,
      quorumHash:
        '0000000007697fd69a799bfa26576a177e817bc0e45b9fcfbf48b362b05aeff2',
      signersCount: 400,
      signers:
        'bf7fffaffedffef77fef7ffffffcbdffaffffffffffffdfffff7f7f7fff7ffefbfffffdff1fdbf7feffcffbb1f0000000000',
      validMembersCount: 400,
      validMembers:
        'bf7fffaffedffef77fef7ffffffcbfffaffffffffffffdfffff7f7f7fff7ffefbfffffdff1fdbf7feffcffbb1f0000000000',
      quorumPublicKey:
        '03a3fbbe99d80a9be8fc59fd4fe43dfbeba9119b688e97493664716cdf15ae47fad70fea7cb93f20fba10d689f9e3c02',
      quorumVvecHash:
        'bede6b120304eb31d173678bb54ffcb0ab91f8d72d5af78b5047f76e393a26a2',
      quorumSig:
        '9944c544e03a478b401b65cabbb24338872613f7d58ff13ab038ab86418ec70ef1734ff43e965ccb83e02da83b10d44c0f23c630752cfb29b402149a1fc3fad0760e6341a4a1031efad2983c8637d2a461e9bcaf935b7a4dfa225ed2f7771c75',
      membersSig:
        '92eda5c13583577719bea9337b4b9b6286ac11a072de0955b0dc5a012280bb557a53f9643cee7730dabe2d3a4a19042813ef5d39ae92d0015554954011c1e12bc688d4d7672ac33c4001e0dedbfe5d0316f2ad23206d478964ca62d75f50e4d0',
    };

    quorum = new QuorumEntry(quorumEntryJSON);

    expectedRequestId3 =
      '0c51861d1b2de58610a0cdc7518be05892f1201992a71dd93958ea1eee7c9df7';

    quorumEntryJSON4 = {
      version: 1,
      llmqType: 1,
      quorumHash:
        '00000a95d081a06e2ec67932b14b70b9d8ef3a586cd27ba288afe66d0fc069c2',
      signersCount: 50,
      signers: 'ffffffffffff03',
      validMembersCount: 50,
      validMembers: 'ffffffffffff03',
      quorumPublicKey:
        '86d0992f5c73b8f57101c34a0c4ebb17d962bb935a738c1ef1e2bb1c25034d8e4a0a2cc96e0ebc69a7bf3b8b67b2de5f',
      quorumVvecHash:
        '66db73de07442a06de20a171828abbd81589f8c6dc099cdc191d22f40aab1096',
      quorumSig:
        '1604a01eb78aa70fb28d12ab01fb9a3632036ff19fa249e5809e425ea09bda515a3d03d3c04901f8cb9ce35ef17cac4208dd21f3ffa4847a26c03357e5c2db2d0cd1b406e75389dc61effa4a8e30d287d4349cdb94d801ae3fe542c36460f2b8',
      membersSig:
        '140f5a4db1a3330b7dfdda8fe181137b2644577efd843a60401f0dbc7b0856782578bc9d6ab1a0b133596bcc158d781d02ed4db881cb4cc3260273dc90a53c1d1ce37930fa106c47db4cf7702b2e956dcafb7b180bea7aae2d662b7a6c217f27',
    };

    str4 = '7f0500000a07fdd12cf5d5ebb35bd0d0a8fd1d5557616624146b49f30a712f924aa57576b4117577aaef9d19115ff9ae45974f476c1c378879daa4f1dfe3c2b8b72df8423c483f4c6d39a61fc2181e279669108a12059634d6df232f6daae261b3c59667ce07eea6c2fc74b8a20400c66f478be5d59ecd888ebf6d677341a6d888f622c7';
    buf4 = Buffer.from(str4, 'hex');

    quorumEntryJSON4 = {
      isVerified: false,
      isOutdatedRPC: false,
      version: 3,
      llmqType: 100,
      quorumHash: '702a256bfb71f5036c840bbfabc999d9f4ea4c9e721c68f55bd7463138a89130',
      quorumIndex: 0,
      signersCount: 3,
      signers: '07',
      validMembersCount: 3,
      validMembers: '07',
      quorumPublicKey: '8980c2da461929c2b4584d57ab0f8d016ac3f904c4adee8322766602dc9b1763a132984ad300c057d6ccb8f0f52fde09',
      quorumVvecHash: '7de6279950d201802e0ee654b961cab12fbdc871569e903f0af177a6a7f16b62',
      quorumSig: 'a4d2c36a94f36ebadfcceae58d1d76b958e2a6d01c71411730ac1d987d5b18ce4055fa92bace2c32daf110daa6cb69a5058e9bbdd51675f8fb5e5a0bf7b7bd24af179fa613dee5e0e3114a106b0984d633bd54aafd4a18d971163a6b320e3a5b',
      membersSig: '874532a268d41f5d589c47ab66a85e4b89cf81aa5f02174fbd578e641ef0ac5fc8ba6fd31cdc1fe013b1f22987dd0865172735282b0bf7886e516eb08c2444829e89d0b19d337462c6e8204cacc9d9b6775d375a4ae5a3b03f9b5955ac48b5e1'
    };

    quorum4 = new QuorumEntry(quorumEntryJSON4);
  });

  it(`should have 'clsig' constant prefix`, function () {
    expect(ChainLock.CLSIG_REQUESTID_PREFIX).to.deep.equal('clsig');
  });
  describe('instantiation', function () {
    describe('fromBuffer', function () {
      it('should be able to parse data from a buffer', function () {
        const chainLock = ChainLock.fromBuffer(buf2);
        const chainLockStr = chainLock.toString();
        expect(chainLockStr).to.be.deep.equal(str2);
        const chainLockJSON = chainLock.toObject();
        expect(chainLockJSON).to.be.deep.equal(object2);
      });
    });

    describe('fromObject', function () {
      it('Should be able to parse data from an object', function () {
        const chainLock = ChainLock.fromObject(object2);
        const chainLockStr = chainLock.toString();
        expect(chainLockStr).to.be.deep.equal(str2);
      });
    });

    describe('fromString', function () {
      it('Should be able to parse data from a hex string', function () {
        const chainLock = ChainLock.fromHex(str2);
        const chainLockJSON = chainLock.toObject();
        const chainLockBuffer = chainLock.toBuffer().toString('hex');
        expect(chainLockJSON).to.be.deep.equal(object2);

        expect(chainLockBuffer).to.be.deep.equal(buf2.toString('hex'));
      });
    });

    describe('clone itself', function () {
      it('can be instantiated from another chainlock', function () {
        const chainLock = ChainLock.fromBuffer(buf2);
        const chainLock2 = new ChainLock(chainLock);
        expect(chainLock2.toString()).to.equal(chainLock.toString());
      });
    });
  });

  describe('validation', function () {
    describe('#verifySignatureAgainstQuorum', function () {
      it('should verify signature against single quorum', async function () {
        const chainLock = new ChainLock(buf4);
        const requestId = chainLock.getRequestId();
        const isValid = await chainLock.verifySignatureAgainstQuorum(
          quorum4,
          requestId
        );
        expect(isValid).to.equal(true);
      });
    });
    describe('#verify', function () {
      this.timeout(15000);
      it('should verify signature against SMLStore', async function () {
        Networks.enableRegtest();

        const chainLock = new ChainLock(buf4);
        const smlDiffArray = SMNListFixture.getChainlockDiffArray();
        const SMLStore = new SimplifiedMNListStore(smlDiffArray);
        const isValid = await chainLock.verify(SMLStore);
        expect(isValid).to.equal(true);
      });
      it('should return false if SML store does not have a signatory candidate', async function () {
        const chainLock = new ChainLock(buf4);
        const smlDiffArray = SMNListFixture.getChainlockDiffArray();
        const SMLStore = new SimplifiedMNListStore(smlDiffArray);
        SMLStore.getSMLbyHeight = function () {
          var sml = new SimplifiedMNList();
          sml.network = Networks.testnet;
          return sml;
        };
        const isValid = await chainLock.verify(SMLStore);
        expect(isValid).to.equal(false);
      });
    });
  });

  describe('computation', function () {
    describe('#getHash', function () {
      it('should compute the hash', function () {
        const hash = ChainLock.fromBuffer(buf2).getHash().toString('hex');
        expect(hash).to.deep.equal(expectedHash2);
      });
    });
    describe('#getRequestId', function () {
      it('should compute the requestId', function () {
        const chainLock2 = new ChainLock(object2);
        const requestId2 = chainLock2.getRequestId().toString('hex');
        expect(requestId2).to.deep.equal(expectedRequestId2);

        const chainLock3 = new ChainLock(str3);
        const requestId3 = chainLock3.getRequestId().toString('hex');
        expect(requestId3).to.deep.equal(expectedRequestId3);
      });
    });
  });

  describe('output', function () {
    describe('#copy', function () {
      it('should output formatted output correctly', function () {
        const chainLock = ChainLock.fromBuffer(Buffer.from(str2, 'hex'));
        const chainLockCopy = chainLock.copy();
        expect(chainLockCopy).to.deep.equal(chainLock);
      });
    });
    describe('#toBuffer', function () {
      it('should output formatted output correctly', function () {
        const chainLock = ChainLock.fromBuffer(buf2);
        expect(chainLock.toBuffer().toString('hex')).to.deep.equal(str2);
      });
    });
    describe('#toJSON/#toObject', function () {
      it('should output formatted output correctly', function () {
        const chainLock = ChainLock.fromBuffer(buf);
        expect(chainLock.toObject()).to.deep.equal(chainLock.toJSON());
        expect(chainLock.toObject()).to.deep.equal(object);

        const chainLock2 = ChainLock.fromBuffer(buf2);
        expect(chainLock2.toObject()).to.deep.equal(chainLock2.toJSON());
        expect(chainLock2.toObject()).to.deep.equal(object2);
      });
    });
    describe('#toString', function () {
      it('should output formatted output correctly', function () {
        const chainLock = ChainLock.fromBuffer(buf2);
        expect(chainLock.toString()).to.deep.equal(str2);
      });
    });
    describe('#inspect', function () {
      it('should output formatted output correctly', function () {
        const chainLock = new ChainLock(str);
        const output =
          '<ChainLock: 00000105df60caca6a257d8f2f90d422f2d1abf6658555650d5c2c8ecd209e25, height: 382312>';
        expect(chainLock.inspect()).to.be.equal(output);
      });
    });
  });
});
