// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FreelanceEscrow
 * @notice Escrow pembayaran freelance berbasis milestone dengan auto-release dan arbitrator.
 *
 * SIMULASI AKADEMIK - Sepolia testnet (DTSC6018001, BINUS University).
 * Bukan layanan finansial. Di Indonesia hanya Rupiah yang merupakan alat pembayaran
 * yang sah (UU No. 7/2011 Pasal 21, PBI 18/40/2016 Pasal 34).
 *
 * Satu contract registry menampung banyak proyek, sehingga cukup sekali deploy.
 *
 * Jaminan utama yang ditegakkan di level contract (bukan sekadar aturan UI):
 *  - Dana terkunci sejak deposit dan tidak bisa ditarik sepihak oleh klien.
 *  - Freelancer hanya bisa submitWork() bila milestone sudah berstatus Funded.
 *  - Bila klien diam melewati reviewPeriod, siapa pun boleh memicu autoRelease()
 *    sehingga dana tetap cair ke freelancer.
 *  - Seluruh input berasal dari klien dan freelancer sendiri; tidak ada oracle eksternal.
 */
contract FreelanceEscrow is ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Tipe data
    // -------------------------------------------------------------------------

    enum MilestoneState {
        None, // belum didanai
        Funded, // dana terkunci di contract
        Submitted, // hasil kerja sudah dikirim, menunggu review klien
        Released, // dana sudah cair ke freelancer
        Refunded, // dana dikembalikan ke klien
        Disputed // sedang disengketakan, menunggu arbitrator
    }

    struct Milestone {
        uint256 amount;
        MilestoneState state;
        string cid; // CID IPFS bukti hasil kerja
        uint256 submittedAt; // titik mulai hitungan reviewPeriod
    }

    struct Project {
        address client;
        address freelancer;
        address arbitrator;
        uint256 reviewPeriod; // detik; produksi 7 hari, demo 3-5 menit
        uint256 createdAt;
        string title;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    uint256 public nextProjectId = 1; // mulai dari 1, id 0 berarti tidak ada
    mapping(uint256 => Project) private _projects;
    mapping(uint256 => Milestone[]) private _milestones;

    // -------------------------------------------------------------------------
    // Events - dipakai front-end untuk menyusun daftar proyek tanpa indexer
    // -------------------------------------------------------------------------

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        address indexed freelancer,
        address arbitrator,
        uint256 reviewPeriod,
        uint256 milestoneCount,
        uint256 totalAmount,
        string title
    );
    event MilestoneFunded(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount);
    event WorkSubmitted(uint256 indexed projectId, uint256 indexed milestoneIndex, string cid, uint256 submittedAt);
    event MilestoneApproved(uint256 indexed projectId, uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount);
    event MilestoneAutoReleased(uint256 indexed projectId, uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount, address triggeredBy);
    event DisputeRaised(uint256 indexed projectId, uint256 indexed milestoneIndex, address indexed raisedBy);
    event DisputeResolved(uint256 indexed projectId, uint256 indexed milestoneIndex, bool releasedToFreelancer, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ProjectNotFound();
    error MilestoneNotFound();
    error NotClient();
    error NotFreelancer();
    error NotArbitrator();
    error NotParticipant();
    error InvalidState(MilestoneState current, MilestoneState required);
    error IncorrectAmount(uint256 sent, uint256 required);
    error ReviewPeriodNotOver(uint256 nowTs, uint256 releasableAt);
    error InvalidAddress();
    error NoMilestones();
    error ZeroAmount();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Modifiers - kontrol akses sesuai slide 11
    // -------------------------------------------------------------------------

    modifier projectExists(uint256 projectId) {
        if (_projects[projectId].client == address(0)) revert ProjectNotFound();
        _;
    }

    modifier onlyClient(uint256 projectId) {
        if (msg.sender != _projects[projectId].client) revert NotClient();
        _;
    }

    modifier onlyFreelancer(uint256 projectId) {
        if (msg.sender != _projects[projectId].freelancer) revert NotFreelancer();
        _;
    }

    modifier onlyArbitrator(uint256 projectId) {
        if (msg.sender != _projects[projectId].arbitrator) revert NotArbitrator();
        _;
    }

    // -------------------------------------------------------------------------
    // Fungsi utama
    // -------------------------------------------------------------------------

    /**
     * @notice Klien membuat kontrak kerja beserta rincian milestone-nya.
     * @dev Pembuatan proyek belum memindahkan dana apa pun; pendanaan dilakukan
     *      terpisah lewat deposit() per milestone.
     */
    function createProject(
        address freelancer,
        address arbitrator,
        uint256 reviewPeriod,
        uint256[] calldata milestoneAmounts,
        string calldata title
    ) external returns (uint256 projectId) {
        if (freelancer == address(0) || arbitrator == address(0)) revert InvalidAddress();
        // Klien tidak boleh merangkap peran lain, agar escrow tetap bermakna.
        if (freelancer == msg.sender || arbitrator == msg.sender || arbitrator == freelancer) {
            revert InvalidAddress();
        }
        if (milestoneAmounts.length == 0) revert NoMilestones();
        if (reviewPeriod == 0) revert ZeroAmount();

        projectId = nextProjectId++;

        _projects[projectId] = Project({
            client: msg.sender,
            freelancer: freelancer,
            arbitrator: arbitrator,
            reviewPeriod: reviewPeriod,
            createdAt: block.timestamp,
            title: title
        });

        uint256 totalAmount;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            if (milestoneAmounts[i] == 0) revert ZeroAmount();
            totalAmount += milestoneAmounts[i];
            _milestones[projectId].push(
                Milestone({amount: milestoneAmounts[i], state: MilestoneState.None, cid: "", submittedAt: 0})
            );
        }

        emit ProjectCreated(
            projectId,
            msg.sender,
            freelancer,
            arbitrator,
            reviewPeriod,
            milestoneAmounts.length,
            totalAmount,
            title
        );
    }

    /**
     * @notice Klien mengunci dana untuk satu milestone. Setelah ini dana tidak bisa
     *         ditarik sepihak oleh klien - satu-satunya jalan keluar adalah approve,
     *         autoRelease, atau putusan arbitrator.
     */
    function deposit(uint256 projectId, uint256 milestoneIndex)
        external
        payable
        projectExists(projectId)
        onlyClient(projectId)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.None) revert InvalidState(m.state, MilestoneState.None);
        if (msg.value != m.amount) revert IncorrectAmount(msg.value, m.amount);

        m.state = MilestoneState.Funded;

        emit MilestoneFunded(projectId, milestoneIndex, msg.value);
    }

    /**
     * @notice Freelancer mengirim hasil kerja berupa CID IPFS.
     * @dev INVARIANT INTI (slide 8 & 9): hanya bisa dipanggil bila milestone sudah
     *      Funded. Freelancer tidak akan pernah bekerja untuk dana yang belum terkunci.
     */
    function submitWork(uint256 projectId, uint256 milestoneIndex, string calldata cid)
        external
        projectExists(projectId)
        onlyFreelancer(projectId)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Funded) revert InvalidState(m.state, MilestoneState.Funded);

        m.cid = cid;
        m.submittedAt = block.timestamp;
        m.state = MilestoneState.Submitted;

        emit WorkSubmitted(projectId, milestoneIndex, cid, block.timestamp);
    }

    /**
     * @notice Klien menyetujui hasil kerja; dana milestone langsung cair ke freelancer.
     */
    function approve(uint256 projectId, uint256 milestoneIndex)
        external
        nonReentrant
        projectExists(projectId)
        onlyClient(projectId)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Submitted) revert InvalidState(m.state, MilestoneState.Submitted);

        // checks-effects-interactions: ubah state dulu, kirim dana belakangan
        m.state = MilestoneState.Released;
        uint256 amount = m.amount;
        address freelancer = _projects[projectId].freelancer;

        _pay(freelancer, amount);

        emit MilestoneApproved(projectId, milestoneIndex, freelancer, amount);
    }

    /**
     * @notice Bila klien diam melewati reviewPeriod, dana cair ke freelancer.
     * @dev Sengaja permissionless - siapa pun boleh memicu. Kalau fungsi ini dibatasi
     *      hanya untuk freelancer, klien yang diam masih bisa menahan dana dengan cara
     *      membuat freelancer kehabisan gas. Sikap diam klien harus berhenti menguntungkan.
     */
    function autoRelease(uint256 projectId, uint256 milestoneIndex)
        external
        nonReentrant
        projectExists(projectId)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Submitted) revert InvalidState(m.state, MilestoneState.Submitted);

        uint256 releaseTime = m.submittedAt + _projects[projectId].reviewPeriod;
        if (block.timestamp < releaseTime) revert ReviewPeriodNotOver(block.timestamp, releaseTime);

        m.state = MilestoneState.Released;
        uint256 amount = m.amount;
        address freelancer = _projects[projectId].freelancer;

        _pay(freelancer, amount);

        emit MilestoneAutoReleased(projectId, milestoneIndex, freelancer, amount, msg.sender);
    }

    /**
     * @notice Klien atau freelancer mengangkat sengketa atas milestone yang sedang berjalan.
     */
    function raiseDispute(uint256 projectId, uint256 milestoneIndex) external projectExists(projectId) {
        Project storage p = _projects[projectId];
        if (msg.sender != p.client && msg.sender != p.freelancer) revert NotParticipant();

        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Funded && m.state != MilestoneState.Submitted) {
            revert InvalidState(m.state, MilestoneState.Submitted);
        }

        m.state = MilestoneState.Disputed;

        emit DisputeRaised(projectId, milestoneIndex, msg.sender);
    }

    /**
     * @notice Arbitrator memutuskan sengketa. Putusan bersifat final di level contract.
     * @param releaseToFreelancer true = dana cair ke freelancer, false = dikembalikan ke klien.
     */
    function resolveDispute(uint256 projectId, uint256 milestoneIndex, bool releaseToFreelancer)
        external
        nonReentrant
        projectExists(projectId)
        onlyArbitrator(projectId)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Disputed) revert InvalidState(m.state, MilestoneState.Disputed);

        Project storage p = _projects[projectId];
        uint256 amount = m.amount;

        m.state = releaseToFreelancer ? MilestoneState.Released : MilestoneState.Refunded;
        address recipient = releaseToFreelancer ? p.freelancer : p.client;

        _pay(recipient, amount);

        emit DisputeResolved(projectId, milestoneIndex, releaseToFreelancer, amount);
    }

    // -------------------------------------------------------------------------
    // View helpers untuk front-end
    // -------------------------------------------------------------------------

    function getProject(uint256 projectId) external view projectExists(projectId) returns (Project memory) {
        return _projects[projectId];
    }

    function getMilestones(uint256 projectId) external view projectExists(projectId) returns (Milestone[] memory) {
        return _milestones[projectId];
    }

    function getMilestoneCount(uint256 projectId) external view projectExists(projectId) returns (uint256) {
        return _milestones[projectId].length;
    }

    /// @notice Kapan milestone bisa di-autoRelease. 0 berarti belum ada penghitungan berjalan.
    function releasableAt(uint256 projectId, uint256 milestoneIndex)
        external
        view
        projectExists(projectId)
        returns (uint256)
    {
        Milestone storage m = _getMilestone(projectId, milestoneIndex);
        if (m.state != MilestoneState.Submitted) return 0;
        return m.submittedAt + _projects[projectId].reviewPeriod;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _getMilestone(uint256 projectId, uint256 milestoneIndex) private view returns (Milestone storage) {
        if (milestoneIndex >= _milestones[projectId].length) revert MilestoneNotFound();
        return _milestones[projectId][milestoneIndex];
    }

    function _pay(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
