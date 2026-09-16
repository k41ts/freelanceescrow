import { expect } from "chai";
import { network } from "hardhat";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

describe("FreelanceEscrow", () => {
  let ethers: any;
  let networkHelpers: any;
  let escrow: any;
  let client: any;
  let freelancer: any;
  let arbitrator: any;
  let outsider: any;
  let amount: bigint;

  beforeEach(async () => {
    // create() memberi jaringan simulasi baru tiap test, sehingga state antar test terisolasi.
    const connection = await network.create();
    ethers = connection.ethers;
    networkHelpers = connection.networkHelpers;

    [client, freelancer, arbitrator, outsider] = await ethers.getSigners();
    escrow = await ethers.deployContract("FreelanceEscrow");
    await escrow.waitForDeployment();

    amount = ethers.parseEther("0.01");
  });

  /** Membuat proyek satu milestone. Mengembalikan projectId. */
  async function createProject(amounts: bigint[] = [amount], reviewPeriod = SEVEN_DAYS) {
    await escrow
      .connect(client)
      .createProject(freelancer.address, arbitrator.address, reviewPeriod, amounts, "Desain logo");
    return (await escrow.nextProjectId()) - 1n;
  }

  describe("createProject", () => {
    it("menyimpan peran dan milestone dengan benar", async () => {
      const id = await createProject([amount, amount * 2n]);

      const project = await escrow.getProject(id);
      expect(project.client).to.equal(client.address);
      expect(project.freelancer).to.equal(freelancer.address);
      expect(project.arbitrator).to.equal(arbitrator.address);
      expect(project.reviewPeriod).to.equal(SEVEN_DAYS);

      const milestones = await escrow.getMilestones(id);
      expect(milestones.length).to.equal(2);
      expect(milestones[0].amount).to.equal(amount);
      expect(milestones[1].amount).to.equal(amount * 2n);
      expect(milestones[0].state).to.equal(0n); // None
    });

    it("menolak bila klien merangkap sebagai freelancer", async () => {
      await expect(
        escrow.connect(client).createProject(client.address, arbitrator.address, SEVEN_DAYS, [amount], "X")
      ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("menolak proyek tanpa milestone", async () => {
      await expect(
        escrow.connect(client).createProject(freelancer.address, arbitrator.address, SEVEN_DAYS, [], "X")
      ).to.be.revertedWithCustomError(escrow, "NoMilestones");
    });
  });

  describe("deposit", () => {
    it("mengunci dana dan mengubah state menjadi Funded", async () => {
      const id = await createProject();
      await expect(escrow.connect(client).deposit(id, 0, { value: amount }))
        .to.emit(escrow, "MilestoneFunded")
        .withArgs(id, 0, amount);

      const milestones = await escrow.getMilestones(id);
      expect(milestones[0].state).to.equal(1n); // Funded
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amount);
    });

    it("menolak nominal yang tidak sama persis", async () => {
      const id = await createProject();
      await expect(
        escrow.connect(client).deposit(id, 0, { value: amount - 1n })
      ).to.be.revertedWithCustomError(escrow, "IncorrectAmount");
    });

    it("hanya klien yang boleh deposit", async () => {
      const id = await createProject();
      await expect(
        escrow.connect(outsider).deposit(id, 0, { value: amount })
      ).to.be.revertedWithCustomError(escrow, "NotClient");
    });
  });

  describe("submitWork", () => {
    // Ini klaim utama slide 8 & 9 - dijaga di level contract, bukan aturan UI.
    it("DITOLAK bila dana belum terkunci", async () => {
      const id = await createProject();
      await expect(
        escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid")
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("berhasil setelah milestone didanai", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });

      await expect(escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid")).to.emit(escrow, "WorkSubmitted");

      const milestones = await escrow.getMilestones(id);
      expect(milestones[0].state).to.equal(2n); // Submitted
      expect(milestones[0].cid).to.equal("QmDummyCid");
    });

    it("hanya freelancer yang boleh submit", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await expect(
        escrow.connect(outsider).submitWork(id, 0, "QmDummyCid")
      ).to.be.revertedWithCustomError(escrow, "NotFreelancer");
    });
  });

  describe("approve - happy path", () => {
    it("mencairkan dana ke freelancer", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");

      const before = await ethers.provider.getBalance(freelancer.address);
      await escrow.connect(client).approve(id, 0);
      const after = await ethers.provider.getBalance(freelancer.address);

      expect(after - before).to.equal(amount);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);

      const milestones = await escrow.getMilestones(id);
      expect(milestones[0].state).to.equal(3n); // Released
    });

    it("hanya klien yang boleh approve", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");

      await expect(escrow.connect(outsider).approve(id, 0)).to.be.revertedWithCustomError(escrow, "NotClient");
      await expect(escrow.connect(freelancer).approve(id, 0)).to.be.revertedWithCustomError(escrow, "NotClient");
    });

    it("tidak bisa approve dua kali", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");
      await escrow.connect(client).approve(id, 0);

      await expect(escrow.connect(client).approve(id, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("multi-milestone", () => {
    it("setiap tahap berjalan berurutan dengan perlindungan yang sama", async () => {
      const id = await createProject([amount, amount * 2n]);

      // Milestone 0
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmTahap1");
      await escrow.connect(client).approve(id, 0);

      // Milestone 1 masih belum didanai - submit harus tetap ditolak
      await expect(
        escrow.connect(freelancer).submitWork(id, 1, "QmTahap2")
      ).to.be.revertedWithCustomError(escrow, "InvalidState");

      await escrow.connect(client).deposit(id, 1, { value: amount * 2n });
      await escrow.connect(freelancer).submitWork(id, 1, "QmTahap2");
      await escrow.connect(client).approve(id, 1);

      const milestones = await escrow.getMilestones(id);
      expect(milestones[0].state).to.equal(3n);
      expect(milestones[1].state).to.equal(3n);
    });
  });

  describe("autoRelease", () => {
    it("ditolak sebelum reviewPeriod lewat", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");

      await expect(escrow.connect(freelancer).autoRelease(id, 0)).to.be.revertedWithCustomError(
        escrow,
        "ReviewPeriodNotOver"
      );
    });

    it("cair ke freelancer setelah klien diam melewati batas waktu", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");

      await networkHelpers.time.increase(SEVEN_DAYS + 1);

      const before = await ethers.provider.getBalance(freelancer.address);
      // Dipicu oleh pihak ketiga - membuktikan fungsi ini permissionless
      await escrow.connect(outsider).autoRelease(id, 0);
      const after = await ethers.provider.getBalance(freelancer.address);

      expect(after - before).to.equal(amount);
    });

    it("tidak bisa dipakai bila kerja belum disubmit", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await networkHelpers.time.increase(SEVEN_DAYS + 1);

      await expect(escrow.connect(freelancer).autoRelease(id, 0)).to.be.revertedWithCustomError(
        escrow,
        "InvalidState"
      );
    });
  });

  describe("dispute", () => {
    it("arbitrator dapat mencairkan dana ke freelancer", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");
      await escrow.connect(client).raiseDispute(id, 0);

      const before = await ethers.provider.getBalance(freelancer.address);
      await escrow.connect(arbitrator).resolveDispute(id, 0, true);
      const after = await ethers.provider.getBalance(freelancer.address);

      expect(after - before).to.equal(amount);
    });

    it("arbitrator dapat mengembalikan dana ke klien", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");
      await escrow.connect(freelancer).raiseDispute(id, 0);

      const before = await ethers.provider.getBalance(client.address);
      await escrow.connect(arbitrator).resolveDispute(id, 0, false);
      const after = await ethers.provider.getBalance(client.address);

      expect(after - before).to.equal(amount);

      const milestones = await escrow.getMilestones(id);
      expect(milestones[0].state).to.equal(4n); // Refunded
    });

    it("hanya arbitrator yang boleh memutus", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });
      await escrow.connect(freelancer).submitWork(id, 0, "QmDummyCid");
      await escrow.connect(client).raiseDispute(id, 0);

      await expect(escrow.connect(client).resolveDispute(id, 0, false)).to.be.revertedWithCustomError(
        escrow,
        "NotArbitrator"
      );
      await expect(escrow.connect(outsider).resolveDispute(id, 0, true)).to.be.revertedWithCustomError(
        escrow,
        "NotArbitrator"
      );
    });

    it("pihak luar tidak boleh mengangkat sengketa", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });

      await expect(escrow.connect(outsider).raiseDispute(id, 0)).to.be.revertedWithCustomError(
        escrow,
        "NotParticipant"
      );
    });
  });

  describe("jaminan dana terkunci", () => {
    // Slide 8: "Dana terkunci dan tidak bisa ditarik sepihak oleh siapa pun."
    it("contract tidak punya fungsi withdraw, receive, maupun fallback", async () => {
      const iface: any = escrow.interface;
      const names = iface.fragments
        .filter((f: any) => f.type === "function")
        .map((f: any) => f.name);

      expect(names).to.not.include("withdraw");
      expect(names.some((n: string) => n.toLowerCase().includes("withdraw"))).to.equal(false);

      const hasFallback = iface.fragments.some(
        (f: any) => f.type === "fallback" || f.type === "receive"
      );
      expect(hasFallback).to.equal(false);
    });

    it("klien tidak bisa mengambil kembali dana setelah deposit", async () => {
      const id = await createProject();
      await escrow.connect(client).deposit(id, 0, { value: amount });

      // Satu-satunya jalur keluar dana dari state Funded adalah lewat dispute.
      // Klien tidak bisa memutus sengketanya sendiri.
      await escrow.connect(client).raiseDispute(id, 0);
      await expect(escrow.connect(client).resolveDispute(id, 0, false)).to.be.revertedWithCustomError(
        escrow,
        "NotArbitrator"
      );

      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amount);
    });

    it("mengirim ETH langsung ke contract akan gagal", async () => {
      await expect(
        client.sendTransaction({ to: await escrow.getAddress(), value: ethers.parseEther("0.001") })
      ).to.be.revert(ethers);
    });
  });
});
